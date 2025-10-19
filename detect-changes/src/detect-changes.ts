/**
 * Core logic to detect which packages have changed based on git diff and config file.
 *
 * This module contains pure functions that don't directly interact with GitHub Actions.
 * All inputs are provided as parameters, and outputs are returned as values.
 */

import { execSync } from 'child_process';
import fs from 'fs';


export interface PackageConfig {
	packagePath: string;
	targetRepo:  string;
}

export interface Config {
	packages: PackageConfig[];
}

export interface DetectChangesInput {
	configFile: string;
	baseRef:    string;
	headRef:    string;
}

export interface DetectChangesOutput {
	matrix:       PackageConfig[];
	hasChanges:   boolean;
	changedFiles: string[];
}

export const executeGitCommand = (command: string): string => {
	try {
		return execSync(command, {
			encoding: 'utf8',
			stdio:    [ 'pipe', 'pipe', 'pipe' ],
		}).trim();
	}
	catch (error) {
		return '';
	}
};

export const gitObjectExists = (ref: string): boolean => {
	try {
		execSync(`git cat-file -e ${ ref }`, {
			stdio: [ 'pipe', 'pipe', 'pipe' ],
		});

		return true; // If no error thrown, object exists
	}
	catch (error) {
		return false; // Error thrown means object doesn't exist
	}
};


export function detectChanges(input: DetectChangesInput): DetectChangesOutput {
	const { configFile, baseRef, headRef } = input;

	// Determine comparison range
	let compareBase = '';

	if (baseRef && baseRef !== '0000000000000000000000000000000000000000') {
		// Check if the base commit exists (handles force pushes)
		if (gitObjectExists(baseRef)) {
			compareBase = baseRef;
		}
		else {
			// Base commit not found, falling back to HEAD~1
			compareBase = 'HEAD~1';
		}
	}
	else {
		// No base ref provided, falling back to HEAD~1
		compareBase = 'HEAD~1';
	}

	// Get changed files
	let changedFiles: string[] = [];

	if (compareBase && gitObjectExists(compareBase)) {
		const gitOutput = executeGitCommand(`git diff --name-only ${ compareBase } ${ headRef }`);
		changedFiles = gitOutput ? gitOutput.split('\n').filter(file => file.trim()) : [];
	}

	// Validate config file exists and is valid JSON
	if (!fs.existsSync(configFile))
		throw new Error(`Config file ${ configFile } not found`);


	let packagesConfig: Config;
	try {
		const configContent = fs.readFileSync(configFile, 'utf8');
		packagesConfig = JSON.parse(configContent) as Config;
	}
	catch (error) {
		throw new Error(`Invalid JSON in ${ configFile }: ${ error instanceof Error ? error.message : 'Unknown error' }`);
	}

	// Process each package
	const changedPackages: PackageConfig[] = [];

	for (const pkg of packagesConfig.packages || []) {
		const { packagePath, targetRepo } = pkg;

		if (!packagePath || !targetRepo) {
			// Skip invalid package entries
			continue;
		}

		// Check if any changed files start with the package path
		const hasChanges = changedFiles.some(file => file.startsWith(packagePath + '/'));

		if (hasChanges)
			changedPackages.push(pkg);
	}

	return {
		matrix:       changedPackages,
		hasChanges:   changedPackages.length > 0,
		changedFiles: changedFiles,
	};
}
