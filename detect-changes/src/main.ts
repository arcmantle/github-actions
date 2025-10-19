/**
 * Entry point for the detect-changes GitHub Action.
 * This file is responsible for:
 * - Reading inputs from GitHub Actions
 * - Calling the detectChanges implementation
 * - Setting outputs back to GitHub Actions
 */

import * as core from '@actions/core';

import { detectChanges } from './detect-changes.ts';


async function run(): Promise<void> {
	try {
		// Get inputs from GitHub Actions
		const configFile = core.getInput('config-file');
		const baseRef = core.getInput('base-ref');
		const headRef = core.getInput('head-ref');

		core.info(`Configuration: config-file=${ configFile },`
			+ ` base-ref=${ baseRef }, head-ref=${ headRef }`);

		// Call the core implementation
		const result = detectChanges({
			configFile,
			baseRef,
			headRef,
		});

		// Log changed files
		core.startGroup('Changed files');
		if (result.changedFiles.length > 0)
			result.changedFiles.forEach(file => core.info(file));
		else
			core.info('No changed files detected');

		core.endGroup();

		// Log detected packages
		if (result.hasChanges) {
			core.info(`🚀 Will sync ${ result.matrix.length } package(s)`);
			result.matrix.forEach(pkg => {
				core.info(`📦 Detected changes in: ${ pkg.targetRepo } (${ pkg.packagePath })`);
			});
		}
		else {
			core.info('❕No package changes detected');
		}

		// Set outputs
		core.setOutput('matrix', JSON.stringify(result.matrix));
		core.setOutput('has-changes', result.hasChanges.toString());
		core.setOutput('changed-files', result.changedFiles.join('\n'));
	}
	catch (error) {
		core.setFailed(error instanceof Error ? error.message : String(error));
	}
}

run();
