import  * as core from '@actions/core';
import  * as github from '@actions/github';

try {
const version = core.getInput('version');
core.info(`Version: ${version}`);
const tag = core.getInput('tag');
core.info(`Tag: ${tag}`);
const releaseNotes = core.getInput('release-notes');
core.info(`Release Notes: ${releaseNotes}`);
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    core.setFailed(message);
}

