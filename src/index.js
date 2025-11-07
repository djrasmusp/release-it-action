import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

// Create config file BEFORE importing release-it, as it reads config on import
function ensureConfigFile() {
  // Determine the action directory (where the action is running from)
  // In GitHub Actions, this is typically in _actions directory
  // Try multiple methods to find the action directory
  let actionDir = process.env.GITHUB_ACTION_PATH;
  
  if (!actionDir) {
    // Try to find it from the current working directory
    // When action runs, it's typically in /home/runner/work/_actions/owner/repo/version
    const cwd = process.cwd();
    const actionsMatch = cwd.match(/^(.+\/_actions\/[^\/]+\/[^\/]+(?:\/[^\/]+)?)/);
    if (actionsMatch) {
      actionDir = actionsMatch[1];
    } else {
      // Fallback to current working directory
      actionDir = cwd;
    }
  }

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

  // Create config file in multiple possible locations
  // release-it might look in different places depending on how it's loaded
  const possiblePaths = [
    path.join(actionDir, 'config', 'release-it.json'),
    path.join(process.cwd(), 'config', 'release-it.json'),
  ];

  for (const configFile of possiblePaths) {
    const configDir = path.dirname(configFile);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      core.info(`Created config directory: ${configDir}`);
    }

    if (!fs.existsSync(configFile)) {
      fs.writeFileSync(configFile, JSON.stringify(minimalConfig, null, 2));
      core.info(`Created config file: ${configFile}`);
    } else {
      core.info(`Config file already exists: ${configFile}`);
    }
  }

  core.info(`Action directory: ${actionDir}`);
  core.info(`Current working directory: ${process.cwd()}`);

  // Return the primary config file path
  return possiblePaths[0];
}

async function run() {
  try {
    // Ensure config file exists BEFORE importing release-it
    // This is critical because release-it reads config on import
    const configFilePath = ensureConfigFile();

    // Dynamically import release-it after config file is created
    const { default: releaseIt } = await import('release-it');

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
      configPath: configFilePath, // Explicitly set config path
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

