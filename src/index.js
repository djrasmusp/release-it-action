import * as core from '@actions/core';
import * as path from 'path';
import { execSync } from 'child_process';

// IMPORTANT: Import setup-config FIRST to ensure config files are created
// before release-it is imported (release-it reads config on import)
// The side-effect import runs the config file creation immediately
import './setup-config.js';
import { ensureConfigFileSync } from './setup-config.js';

// Import release-it AFTER config files are set up
// Since release-it is bundled, it's already included in the bundle
import releaseIt from 'release-it';

async function run() {
  try {
    // Ensure config file exists (in case it wasn't created at load time)
    const configFilePath = ensureConfigFileSync();
    
    core.info('Using statically imported release-it');
    core.info(`Config file path: ${configFilePath}`);

    // Configure git user info for CI environment
    // This is required even if we don't commit, as release-it may check git status
    try {
      const gitUser = process.env.GITHUB_ACTOR || 'github-actions[bot]';
      const gitEmail = process.env.GITHUB_ACTOR 
        ? `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
        : 'github-actions[bot]@users.noreply.github.com';
      
      execSync(`git config --global user.name "${gitUser}"`, { stdio: 'ignore' });
      execSync(`git config --global user.email "${gitEmail}"`, { stdio: 'ignore' });
      core.info(`Configured git user: ${gitUser} <${gitEmail}>`);
    } catch (gitConfigError) {
      core.warning(`Failed to configure git user: ${gitConfigError.message}`);
    }

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
      // Don't load config from file - use only programmatic config
      configPath: false, // Disable config file loading
      hooks: {}, // Initialize empty hooks object
      git: {
        commitMessage: "chore: release v${version}",
        requireCleanWorkingDir: false, // Allow uncommitted changes in CI
        push: false, // Don't push to git
        tag: false, // Don't create git tag
        commit: false, // Don't commit changes
        addUntrackedFiles: false, // Don't add untracked files
        ...config.git,
      },
      github: {
        release: false,
        token: githubToken,
        ...config.github,
      },
      gitlab: {
        release: false, // Disable GitLab releases
        ...config.gitlab,
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
    try {
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
    } catch (releaseError) {
      core.error(`release-it error: ${releaseError.message}`);
      if (releaseError.stack) {
        core.error(`Stack trace: ${releaseError.stack}`);
      }
      throw releaseError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(`Release failed: ${message}`);
  }
}

run();

