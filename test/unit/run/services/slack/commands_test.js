const { describe, it } = require('mocha');
const axios = require('axios');
const { sinon } = require('../../../../test-helper');
const {
  createAndDeployPixLCMS,
  createAndDeployPixUI,
  createAndDeployPixSiteRelease,
} = require('../../../../../run/services/slack/commands');
const releasesServicesFromRun = require('../../../../../run/services/releases');
const releasesServicesFromBuild = require('../../../../../build/services/releases');
const githubServices = require('../../../../../common/services/github');

describe('Services | Slack | Commands', () => {
  beforeEach(() => {
    // given
    sinon.stub(axios, 'post');
    sinon.stub(releasesServicesFromRun, 'deployPixRepo').resolves();
    sinon.stub(releasesServicesFromRun, 'deployPixUI').resolves();
    sinon.stub(releasesServicesFromBuild, 'publishPixRepo').resolves();
    sinon.stub(githubServices, 'getLatestReleaseTag').resolves('v1.0.0');
  });

  describe('#createAndDeployPixSiteRelease', () => {
    describe('when releaseType is set to minor', () => {
      beforeEach(async () => {
        // given
        const payload = { text: 'minor', response_url: 'http://example.net/callback' };
        // when
        await createAndDeployPixSiteRelease(payload);
      });

      it('should publish a new release', () => {
        // then
        sinon.assert.calledWith(releasesServicesFromBuild.publishPixRepo, 'pix-site', 'minor');
      });

      it('should retrieve the last release tag from GitHub', () => {
        // then
        sinon.assert.calledWith(githubServices.getLatestReleaseTag, 'pix-site');
      });

      it('should deploy the release for pix-site and pix-pro', () => {
        // then
        sinon.assert.calledWith(releasesServicesFromRun.deployPixRepo, 'pix-site', 'pix-site', 'v1.0.0');
        sinon.assert.calledWith(releasesServicesFromRun.deployPixRepo, 'pix-site', 'pix-pro', 'v1.0.0');
      });

      it('should inform the user of the progress', () => {
        sinon.assert.calledWith(axios.post, 'http://example.net/callback', { text: 'Le script de déploiement de la release \'v1.0.0\' pour pix-site, pix-pro en production s\'est déroulé avec succès. En attente de l\'installation des applications sur Scalingo…' });
      });
    });

    describe('when releaseType is not set to a valid value', () => {
      it('should publish a new minor release', async () => {
        // given
        const payload = { text: '' };
        // when
        await createAndDeployPixSiteRelease(payload);
        // then
        sinon.assert.calledWith(releasesServicesFromBuild.publishPixRepo, 'pix-site', 'minor');
      });
    });

    describe('when something fails', () => {
      it('should inform the user', async () => {
        // given
        const payload = { response_url: 'http://example.net/callback' };
        releasesServicesFromBuild.publishPixRepo.rejects();
        // when
        await createAndDeployPixSiteRelease(payload);
        // then
        sinon.assert.calledWith(axios.post, 'http://example.net/callback', { text: 'Erreur lors du déploiement de pix-site, pix-pro en production.' });
      });
    });
  });

  describe('#createAndDeployPixUI', () => {
    beforeEach(async () => {
      // given
      const payload = { text: 'minor' };
      // when
      await createAndDeployPixUI(payload);
    });

    it('should publish a new release', () => {
      // then
      sinon.assert.calledWith(releasesServicesFromBuild.publishPixRepo, 'pix-ui', 'minor');
    });

    it('should retrieve the last release tag from GitHub', () => {
      // then
      sinon.assert.calledWith(githubServices.getLatestReleaseTag, 'pix-ui');
    });

    it('should deploy the release', () => {
      // then
      sinon.assert.calledWith(releasesServicesFromRun.deployPixUI);
    });
  });

  describe('#createAndDeployPixLCMS', () => {
    beforeEach(async () => {
      // given
      const payload = { text: 'minor' };
      // when
      await createAndDeployPixLCMS(payload);
    });

    it('should publish a new release', () => {
      // then
      sinon.assert.calledWith(releasesServicesFromBuild.publishPixRepo, 'pix-editor', 'minor');
    });

    it('should retrieve the last release tag from GitHub', () => {
      // then
      sinon.assert.calledWith(githubServices.getLatestReleaseTag, 'pix-editor');
    });

    it('should deploy the release', () => {
      // then
      sinon.assert.calledWith(releasesServicesFromRun.deployPixRepo);
    });
  });

});
