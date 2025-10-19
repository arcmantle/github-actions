/**
 * Entry point for the update-dependencies GitHub Action.
 * This file is responsible for:
 * - Reading inputs from GitHub Actions
 * - Calling the updateDependencies implementation
 * - Setting outputs back to GitHub Actions
 */

import * as core from '@actions/core';

import { replaceDependencies } from './replace-dependencies.ts';


async function run(): Promise<void> {
	try {
		// Get inputs from GitHub Actions
		const depMapInput = core.getInput('dep-map', { required: true });
		const packageJsonPath = core.getInput('package-path') || 'package.json';

		core.info(`Configuration: package-json-path=${ packageJsonPath }`);

		// Parse the dependency map
		let depMap: Record<string, Record<string, string>>;
		try {
			depMap = JSON.parse(depMapInput);
		}
		catch (error) {
			throw new Error(
				`Failed to parse dep-map input as JSON: `
				+ `${ error instanceof Error ? error.message : 'Unknown error' }`,
			);
		}

		// Call the core implementation
		const result = replaceDependencies({
			depMap:          depMap,
			packageJsonPath: packageJsonPath,
		});

		// Log changes
		if (result.updated) {
			core.info(`✅ Updated ${ result.changes.length }`
				+ ` dependenc${ result.changes.length === 1 ? 'y' : 'ies' }`);

			core.startGroup('Dependency changes');
			result.changes.forEach(change => {
				core.info(
					`📦 ${ change.dependency } (${ change.section }): `
					+ `${ change.oldVersion } → ${ change.newVersion }`,
				);
			});
			core.endGroup();
		}
		else {
			core.info('❕No dependency updates were applied');
		}

		// Set outputs
		core.setOutput('updated', result.updated.toString());
		core.setOutput('changes', JSON.stringify(result.changes));
	}
	catch (error) {
		core.setFailed(error instanceof Error ? error.message : String(error));
	}
}

run();
