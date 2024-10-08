import { processWebhook } from '../controllers/github.js';
import { commonConfig } from '../../common/config.js';

const github = [
  {
    method: 'POST',
    path: '/run/github/webhook',
    handler: processWebhook,
    config: commonConfig.githubConfig,
  },
];

export default github;
