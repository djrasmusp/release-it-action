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
      hooks: {
        // Add CHANGELOG.md and package.json to git before commit (if they exist)
        // This ensures they are included even though addUntrackedFiles is false
        'before:git:release': [
          'git add CHANGELOG.md package.json package-lock.json 2>/dev/null || true',
          'git reset HEAD config/release-it.json 2>/dev/null || true',
        ],
      },
      plugins: {
        '@release-it/conventional-changelog': {
          infile: 'CHANGELOG.md',
          preset: {
            name: 'conventionalcommits',
            types: [
              { type: "build", section: "🧱 Dependency", hidden: false },
              { type: "chore", section: "🏭 Chores", hidden: false },
              { type: "ci", section: "🚦 CI/CD", hidden: false },
              { type: "docs", section: "📝 Documentation", hidden: false },
              { type: "feat", section: "⭐ New Feature", hidden: false },
              { type: "feature", section: "⭐ New Feature", hidden: false },
              { type: "fix", section: "🐛 Bug Fix", hidden: false },
              { type: "bugfix", section: "🐛 Bug Fix", hidden: false },
              { type: "bug", section: "🐛 Bug Fix", hidden: false },
              { type: "refactor", section: "♻️ Code Refactoring", hidden: false },
              { type: "style", section: "🎨 Styling and Formatting", hidden: false },
              { type: "test", section: "🧪 Code Testing", hidden: false },
            ],
          },
        },
        ...config.plugins,
      },
      git: {
        commitMessage: "chore: release v${version}",
        requireCleanWorkingDir: false, // Allow uncommitted changes in CI
        commit: config.git?.commit ?? true, // Commit changes by default (including CHANGELOG.md)
        // Only add specific files, not all untracked files (to avoid committing config/release-it.json)
        addUntrackedFiles: false,
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

      // Clean up temporary config files that were created
      // These files are only needed for release-it to run, not for the repository
      const tempConfigPath = 'config/release-it.json';
      if (fs.existsSync(tempConfigPath)) {
        try {
          // Remove from git staging if it was added
          try {
            execSync('git reset HEAD config/release-it.json 2>/dev/null || true', { stdio: 'ignore' });
          } catch (e) {
            // Ignore errors
          }
          
          // Remove the file
          fs.unlinkSync(tempConfigPath);
          core.debug(`Removed temporary config file: ${tempConfigPath}`);
          
          // Also remove config directory if it's empty
          const configDir = 'config';
          try {
            const files = fs.readdirSync(configDir);
            if (files.length === 0) {
              fs.rmdirSync(configDir);
              core.debug(`Removed empty config directory`);
            }
          } catch (e) {
            // Ignore errors when removing directory
          }
        } catch (error) {
          core.warning(`Failed to remove temporary config file: ${error.message}`);
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

