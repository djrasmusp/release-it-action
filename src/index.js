import * as core from '@actions/core';
import releaseIt from 'release-it';

async function run() {
  try {
    const githubToken = core.getInput('github-token', { required: true });
    const configInput = core.getInput('config');
    const dryRun = core.getInput('dry-run') === 'true';

    // Parse config if provided, otherwise use defaults
    let config = {};
    if (configInput) {
      try {
        config = JSON.parse(configInput);
      } catch (error) {
        core.warning(`Failed to parse config JSON: ${error.message}`);
      }
    }

    // Set up default configuration
    const releaseItConfig = {
      ci: true, // Run in CI mode (non-interactive)
      dryRun,
      configPath: false, // Disable automatic config file loading
      git: {
        commitMessage: "chore: release v${version}",
        requireCleanWorkingDir: false, // Allow uncommitted changes in CI
        ...config.git,
      },
      github: {
        release: false,
        token: githubToken,
        ...config.github,
      },
      npm: {
        publish: false, // Set to true if you want to publish to npm
        ...config.npm,
      },
      ...config,
    };

    core.info('Running release-it...');
    core.info(`Config: ${JSON.stringify(releaseItConfig, null, 2)}`);

    // Run release-it programmatically
    const result = await releaseIt(releaseItConfig);

    // Set outputs
    if (result) {
      if (result.version) {
        core.setOutput('version', result.version);
        core.info(`Released version: ${result.version}`);
      }
      if (result.latestVersion) {
        core.setOutput('latestVersion', result.latestVersion);
      }
      if (result.changelog) {
        core.setOutput('changelog', result.changelog);
      }
    }

    core.info('Release completed successfully!');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Release failed: ${message}`);
  }
}

run();

