const fs = require('fs');
const path = require('path');

const ScalingoClient = require('../../common/services/scalingo-client');
const gitHubService = require('../../common/services/github');

const repositoryToScalingoAppsReview = {
  'pix-bot': ['pix-bot-review'],
  'pix-data': ['pix-airflow-review'],
  'pix-db-replication': ['pix-datawarehouse-integration'],
  'pix-db-stats': ['pix-db-stats-review'],
  'pix-editor': ['pix-lcms-review'],
  'pix-site': ['pix-site-review', 'pix-pro-review'],
  'pix-tutos': ['pix-tutos-review'],
  'pix-ui': ['pix-ui-review'],
  pix: ['pix-front-review', 'pix-api-review'],
};

function getMessageTemplate(repositoryName) {
  const baseDir = path.join(__dirname, '..', 'templates', 'pull-request-messages');
  let relativeFileName;
  if (fs.existsSync(path.join(baseDir, `${repositoryName}.md`))) {
    relativeFileName = `${repositoryName}.md`;
  } else {
    relativeFileName = 'default.md';
  }

  const messageTemplate = fs.readFileSync(path.join(baseDir, relativeFileName), 'utf8');
  return messageTemplate;
}

function getMessage(repositoryName, pullRequestId, scalingoReviewApps, messageTemplate) {
  const scalingoDashboardUrl = `https://dashboard.scalingo.com/apps/osc-fr1/${scalingoReviewApps[0]}-pr${pullRequestId}/environment`;
  const shortenedRepositoryName = repositoryName.replace('pix-', '');
  const webApplicationUrl = `https://${shortenedRepositoryName}-pr${pullRequestId}.review.pix.fr`;
  const message = messageTemplate
    .replaceAll('{{pullRequestId}}', pullRequestId)
    .replaceAll('{{webApplicationUrl}}', webApplicationUrl)
    .replaceAll('{{scalingoDashboardUrl}}', scalingoDashboardUrl);
  return message;
}

const addMessageToPullRequest = async ({ repositoryName, pullRequestId, scalingoReviewApps }) => {
  const messageTemplate = getMessageTemplate(repositoryName);
  const message = getMessage(repositoryName, pullRequestId, scalingoReviewApps, messageTemplate);

  await gitHubService.commentPullRequest({
    repositoryName,
    pullRequestId,
    comment: message,
  });
};

async function pullRequestOpenedWebhook(request) {
  const payload = request.payload;
  const repository = payload.pull_request.head.repo.name;
  const prId = payload.number;
  const reviewApps = repositoryToScalingoAppsReview[repository];
  const labelsList = payload.pull_request.labels;
  if (payload.pull_request.head.repo.fork) {
    return 'No RA for a fork';
  }
  if (!reviewApps) {
    return 'No RA configured for this repository';
  }
  if (labelsList.some((label) => label.name == 'no-review-app')) {
    return 'RA disabled for this PR';
  }
  try {
    const client = await ScalingoClient.getInstance('reviewApps');
    for (const appName of reviewApps) {
      await client.deployReviewApp(appName, prId);
    }
    await addMessageToPullRequest({
      repositoryName: repository,
      scalingoReviewApps: reviewApps,
      pullRequestId: prId,
    });
    return `Created RA on app ${reviewApps.join(', ')} with pr ${prId}`;
  } catch (error) {
    throw new Error(`Scalingo APIError: ${error.message}`);
  }
}

async function pullRequestSynchronizeWebhook(request) {
  const payload = request.payload;
  const repository = payload.pull_request.head.repo.name;
  const ref = payload.pull_request.head.ref;
  const reviewApps = repositoryToScalingoAppsReview[repository];
  const prId = payload.number;

  try {
    const client = await ScalingoClient.getInstance('reviewApps');
    for (const appName of reviewApps) {
      const reviewAppName = `${appName}-pr${prId}`;
      await client.deployUsingSCM(reviewAppName, ref);
    }
  } catch (error) {
    throw new Error(`Scalingo APIError: ${error.message}`);
  }

  return `Triggered deployment of RA on app ${reviewApps.join(', ')} with pr ${prId}`;
}

module.exports = {
  getMessageTemplate,
  getMessage,
  addMessageToPullRequest,
  async processWebhook(request) {
    const eventName = request.headers['x-github-event'];
    if (eventName === 'pull_request') {
      switch (request.payload.action) {
        case 'opened':
          return pullRequestOpenedWebhook(request);
        case 'synchronize':
          return pullRequestSynchronizeWebhook(request);
      }
      return `Ignoring ${request.payload.action} action`;
    } else {
      return `Ignoring ${eventName} event`;
    }
  },
};
