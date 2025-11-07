import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import releaseIt from 'release-it';

async function run() {
  try {
    const githubToken = core.getInput('github-token', { required: true });
    const configInput = core.getInput('config');
    const dryRun = core.getInput('dry-run') === 'true';

    // Determine the action directory (where the action is running from)
    // In GitHub Actions, this is typically in _actions directory
    const actionDir = process.env.GITHUB_ACTION_PATH || process.cwd();
    const configDir = path.join(actionDir, 'config');
    const configFile = path.join(configDir, 'release-it.json');

    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      core.info(`Created config directory: ${configDir}`);
    }

    // Create minimal config file if it doesn't exist
    if (!fs.existsSync(configFile)) {
      const minimalConfig = {
        git: {
          requireCleanWorkingDir: false,
        },
        github: {
          release: false,
        },
        npm: {
          publish: false,
        },
      };
      fs.writeFileSync(configFile, JSON.stringify(minimalConfig, null, 2));
      core.info(`Created config file: ${configFile}`);
    }

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

