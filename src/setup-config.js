import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

// Create config file synchronously BEFORE importing release-it
// This must run at module load time, before release-it is imported
export function ensureConfigFileSync() {
  const minimalConfig = {
    hooks: {},
    git: {
      requireCleanWorkingDir: false,
    },
    github: {
      release: false,
    },
    gitlab: {
      release: false,
    },
    npm: {
      publish: false,
    },
  };

  const cwd = process.cwd();
  const configPaths = [];

  // Method 1: Try to find _actions directory and construct action path
  // The error shows: /home/runner/work/_actions/djrasmusp/release-it-action/config/release-it.json
  // (without /main) - so we need to create it in both places
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
                  // Create config in repo root (without version) - this is what release-it looks for
                  const repoConfigFile = path.join(repoPath, 'config', 'release-it.json');
                  configPaths.push(repoConfigFile);
                  
                  // Also create in version directories
                  const versions = fs.readdirSync(repoPath);
                  for (const version of versions) {
                    const versionPath = path.join(repoPath, version);
                    if (fs.statSync(versionPath).isDirectory()) {
                      const versionConfigFile = path.join(versionPath, 'config', 'release-it.json');
                      configPaths.push(versionConfigFile);
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

  // Also create package.json files where release-it might look for them
  // release-it looks for package.json to read version information
  const packageJsonPaths = [];
  
  // Add package.json in owner directories (release-it might look there)
  if (process.env.HOME) {
    const workBase = path.join(process.env.HOME, 'work');
    if (fs.existsSync(workBase)) {
      const actionsBase = path.join(workBase, '_actions');
      if (fs.existsSync(actionsBase)) {
        try {
          const owners = fs.readdirSync(actionsBase);
          for (const owner of owners) {
            const ownerPath = path.join(actionsBase, owner);
            if (fs.statSync(ownerPath).isDirectory()) {
              const ownerPackageJson = path.join(ownerPath, 'package.json');
              packageJsonPaths.push(ownerPackageJson);
              
              // Also add in repo directories
              const repos = fs.readdirSync(ownerPath);
              for (const repo of repos) {
                const repoPath = path.join(ownerPath, repo);
                if (fs.statSync(repoPath).isDirectory()) {
                  const repoPackageJson = path.join(repoPath, 'package.json');
                  packageJsonPaths.push(repoPackageJson);
                  
                  // And in version directories
                  const versions = fs.readdirSync(repoPath);
                  for (const version of versions) {
                    const versionPath = path.join(repoPath, version);
                    if (fs.statSync(versionPath).isDirectory()) {
                      const versionPackageJson = path.join(versionPath, 'package.json');
                      packageJsonPaths.push(versionPackageJson);
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

  // Create minimal package.json files
  const minimalPackageJson = {
    name: 'release-it-action',
    version: '1.0.0',
    private: true,
  };

  for (const packageJsonFile of packageJsonPaths) {
    try {
      if (!fs.existsSync(packageJsonFile)) {
        const packageJsonDir = path.dirname(packageJsonFile);
        if (!fs.existsSync(packageJsonDir)) {
          fs.mkdirSync(packageJsonDir, { recursive: true });
        }
        fs.writeFileSync(packageJsonFile, JSON.stringify(minimalPackageJson, null, 2));
        core.info(`Created package.json: ${packageJsonFile}`);
      }
    } catch (error) {
      core.warning(`Failed to create package.json at ${packageJsonFile}: ${error.message}`);
    }
  }

  core.info(`Current working directory: ${cwd}`);
  core.info(`Created config files in ${configPaths.length} locations`);

  // Return the first config file path
  return configPaths[0] || cwdConfigFile;
}

// Execute immediately when this module is imported
// This ensures config files are created before any other imports
try {
  ensureConfigFileSync();
} catch (e) {
  // If we can't create config file at load time, we'll try again in run()
  core.warning(`Could not create config file at load time: ${e.message}`);
}

