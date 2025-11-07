import * as core from '@actions/core';
import * as fs from 'fs';
import { execSync } from 'child_process';

// IMPORTANT: Import setup-config FIRST to ensure config files are created
// before release-it is imported (release-it reads config on import)
import './setup-config.js';
import { ensureConfigFileSync } from './setup-config.js';

// Import release-it AFTER config files are set up
import releaseIt from 'release-it';

async function run() {
  try {
    // Ensure config files exist (in case they weren't created at load time)
    ensureConfigFileSync();

    // Configure git user info for CI environment
    // This is required even if we don't commit, as release-it may check git status
    try {
      const gitUser = process.env.GITHUB_ACTOR || 'github-actions[bot]';
      const gitEmail = process.env.GITHUB_ACTOR 
        ? `${process.env.GITHUB_ACTOR}@users.noreply.github.com`
        : 'github-actions[bot]@users.noreply.github.com';
      
      execSync(`git config --global user.name "${gitUser}"`, { stdio: 'ignore' });
      execSync(`git config --global user.email "${gitEmail}"`, { stdio: 'ignore' });
      core.debug(`Configured git user: ${gitUser} <${gitEmail}>`);
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
      plugins: {
        '@release-it/conventional-changelog': {
          infile: 'CHANGELOG.md',
          preset: {
            name: 'conventionalcommits',
            type: [
              {
                type: 'feat',
                section: 'Features',
              },
              {
                type: 'fix',
                section: 'Bug Fixes',
              },
            ],
          },
        },
        ...config.plugins,
      },
      git: {
        commitMessage: "chore: release v${version}",
        requireCleanWorkingDir: false, // Allow uncommitted changes in CI
        commit: config.git?.commit ?? true, // Commit changes by default (including CHANGELOG.md)
        addUntrackedFiles: true, // Add untracked files like CHANGELOG.md
        // If commit is enabled, also enable push by default (unless explicitly disabled)
        push: config.git?.push ?? (config.git?.commit !== false ? true : false),
        // If commit is enabled, also enable tag by default (unless explicitly disabled)
        tag: config.git?.tag ?? (config.git?.commit !== false ? true : false),
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

      // Verify CHANGELOG.md was created/updated
      const changelogPath = 'CHANGELOG.md';
      if (fs.existsSync(changelogPath)) {
        core.info(`✓ CHANGELOG.md created/updated successfully`);
      } else {
        core.warning(`CHANGELOG.md was not found at ${changelogPath}`);
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

