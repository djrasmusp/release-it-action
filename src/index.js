import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

// Create config file BEFORE importing release-it, as it reads config on import
function ensureConfigFile() {
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

  const cwd = process.cwd();
  const configPaths = [];

  // Method 1: Try to find _actions directory and construct action path
  // The error shows: /home/runner/work/_actions/djrasmusp/release-it-action/main/config/release-it.json
  // We can construct this from GITHUB_WORKSPACE or by finding _actions
  if (process.env.HOME) {
    const workBase = path.join(process.env.HOME, 'work');
    if (fs.existsSync(workBase)) {
      const actionsBase = path.join(workBase, '_actions');
      if (fs.existsSync(actionsBase)) {
        try {
          // Find all action directories
          const owners = fs.readdirSync(actionsBase);
          for (const owner of owners) {
            const ownerPath = path.join(actionsBase, owner);
            if (fs.statSync(ownerPath).isDirectory()) {
              const repos = fs.readdirSync(ownerPath);
              for (const repo of repos) {
                const repoPath = path.join(ownerPath, repo);
                if (fs.statSync(repoPath).isDirectory()) {
                  const versions = fs.readdirSync(repoPath);
                  for (const version of versions) {
                    const versionPath = path.join(repoPath, version);
                    if (fs.statSync(versionPath).isDirectory()) {
                      const configFile = path.join(versionPath, 'config', 'release-it.json');
                      configPaths.push(configFile);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }

  // Method 2: Use GITHUB_ACTION_PATH if available
  if (process.env.GITHUB_ACTION_PATH) {
    const configFile = path.join(process.env.GITHUB_ACTION_PATH, 'config', 'release-it.json');
    if (!configPaths.includes(configFile)) {
      configPaths.push(configFile);
    }
  }

  // Method 3: Current working directory (where the action is being used)
  const cwdConfigFile = path.join(cwd, 'config', 'release-it.json');
  if (!configPaths.includes(cwdConfigFile)) {
    configPaths.push(cwdConfigFile);
  }

  // Create config files in all locations
  for (const configFile of configPaths) {
    const configDir = path.dirname(configFile);
    
    try {
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
    } catch (error) {
      core.warning(`Failed to create config file at ${configFile}: ${error.message}`);
    }
  }

  core.info(`Current working directory: ${cwd}`);
  core.info(`Created config files in ${configPaths.length} locations`);

  // Return the first config file path
  return configPaths[0] || cwdConfigFile;
}

async function run() {
  try {
    // Ensure config file exists BEFORE importing release-it
    // This is critical because release-it reads config on import
    const configFilePath = ensureConfigFile();

    // Dynamically import release-it after config file is created
    // release-it is CommonJS, so we need to handle it correctly
    const releaseItModule = await import('release-it');
    const releaseIt = releaseItModule.default || releaseItModule;

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

