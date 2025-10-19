/**
 * Core logic to update package.json dependencies based on a dependency map.
 *
 * This module contains pure functions that don't directly interact with GitHub Actions.
 * All inputs are provided as parameters, and outputs are returned as values.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';


export interface PackageJson {
	name?:                 string;
	dependencies?:         Record<string, string>;
	devDependencies?:      Record<string, string>;
	peerDependencies?:     Record<string, string>;
	optionalDependencies?: Record<string, string>;
	[key: string]:         unknown;
}

export interface DependencyMap {
	[packageName: string]: {
		[dependencyName: string]: string;
	};
}

export interface UpdateDependenciesInput {
	depMap:          DependencyMap;
	packageJsonPath: string;
}

export interface DependencyChange {
	dependency: string;
	section:    string;
	oldVersion: string;
	newVersion: string;
}

export interface UpdateDependenciesOutput {
	updated: boolean;
	changes: DependencyChange[];
}


/**
 * Updates package.json dependencies based on the provided dependency map.
 *
 * @param input - The input configuration
 * @returns The result of the update operation
 */
export function replaceDependencies(input: UpdateDependenciesInput): UpdateDependenciesOutput {
	const { depMap, packageJsonPath } = input;

	// Validate package.json exists
	if (!existsSync(packageJsonPath))
		throw new Error(`package.json not found at: ${ packageJsonPath }`);


	// Read and parse package.json
	let pkg: PackageJson;
	try {
		const content = readFileSync(packageJsonPath, 'utf8');
		pkg = JSON.parse(content) as PackageJson;
	}
	catch (error) {
		throw new Error(
			`Failed to read/parse package.json at ${ packageJsonPath }: `
			+ `${ error instanceof Error ? error.message : 'Unknown error' }`,
		);
	}

	// Get the dependencies for this package
	const pkgDeps = depMap[pkg.name ?? ''];

	if (!pkgDeps) {
		// No matching dependencies for this package
		return {
			updated: false,
			changes: [],
		};
	}

	// Define the sections to check
	const sections = [
		'dependencies',
		'devDependencies',
		'peerDependencies',
		'optionalDependencies',
	] as const;

	const changes: DependencyChange[] = [];

	// Update dependencies
	for (const [ dep, version ] of Object.entries(pkgDeps)) {
		// Find which section contains this dependency
		const sectionWithDep = sections.find(
			section => pkg[section] && Object.hasOwn(pkg[section] as object, dep),
		);

		if (!sectionWithDep) {
			// Dependency not found in package.json, skip it
			continue;
		}

		const oldVersion = (pkg[sectionWithDep] as Record<string, string>)[dep];

		// Update the version
		(pkg[sectionWithDep] as Record<string, string>)[dep] = version;

		changes.push({
			dependency: dep,
			section:    sectionWithDep,
			oldVersion: oldVersion,
			newVersion: version,
		});
	}

	// Write updated package.json if changes were made
	if (changes.length > 0) {
		try {
			writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
		}
		catch (error) {
			throw new Error(
				`Failed to write package.json at ${ packageJsonPath }: `
				+ `${ error instanceof Error ? error.message : 'Unknown error' }`,
			);
		}
	}

	return {
		updated: changes.length > 0,
		changes: changes,
	};
}
