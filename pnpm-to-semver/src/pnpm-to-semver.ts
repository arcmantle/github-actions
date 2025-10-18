import fs from 'node:fs';
import path from 'node:path';


interface PNPMWorkspaceState {
	projects:  Record<string, { name: string; version?: string; }>;
	settings?: {
		catalogs?: Record<'default' | (string & Record<never, never>), Record<string, string>>;
	};
}

type DepRecord = Record<string, string> | undefined;

interface PackageJson {
	name?:                 string;
	version?:              string;
	dependencies?:         DepRecord;
	devDependencies?:      DepRecord;
	peerDependencies?:     DepRecord;
	optionalDependencies?: DepRecord;
}

interface UpdateEntry {
	from:   string; // original specifier from package.json
	to:     string; // resolved semver specifier we plan to use
	reason: 'workspace' | 'catalog';
}

// packageName => { depName: UpdateEntry }
export type UpdateMap = Record<string, Record<string, UpdateEntry>>;


export function pnpmToSemver(
	projectFilter?: {
		include?: string[];
		exclude?: string[];
	}
): string {
	const statePath = path.resolve(process.cwd(), 'node_modules', '.pnpm-workspace-state-v1.json');
	const raw = fs.readFileSync(statePath, 'utf8');
	const data: PNPMWorkspaceState = JSON.parse(raw);

	console.log('workspace state', data);

	// index projects
	let projects = Object.entries(data.projects)
		.map(([ absPath, meta ]) => ({ path: absPath, name: meta.name, version: meta.version ?? null }))
		.sort((a, b) => a.path.localeCompare(b.path));

	// lookups
	const nameToVersion: Map<string, string> = new Map();
	for (const p of projects) {
		if (p.version)
			nameToVersion.set(p.name, p.version);
	}

	// apply project filter after storing nameToVersion for workspace resolution
	projects = projects.filter(project => {
		if (projectFilter.include && !projectFilter.include.includes(project.name))
			return false;
		if (projectFilter.exclude && projectFilter.exclude.includes(project.name))
			return false;

		return true;
	});

	console.log('projects', projects);


	const catalogs = (data.settings?.catalogs ?? {}) as Record<string, Record<string, string>>;
	const defaultCatalog: Record<string, string> = catalogs['default'] ?? {};

	// resolvers
	function resolveWorkspaceSpec(depName: string, spec: string): string | null {
		const base = nameToVersion.get(depName);
		if (!base)
			return null;

		const suffix = spec.slice('workspace:'.length).trim();
		let op: '' | '^' | '~' = '';
		if (suffix === '' || suffix === '*' || suffix === '^')
			op = '^';
		else if (suffix === '~')
			op = '~';
		else if (/^[~^]/.test(suffix))
			op = suffix[0] as '^' | '~';
		else if (/^\d/.test(suffix))
			op = '';

		return `${ op }${ base }`;
	}

	function resolveCatalogSpec(depName: string, spec: string): string | null {
		const catName = spec.slice('catalog:'.length).trim() || 'default';
		const catalog = catalogs[catName] ?? defaultCatalog;

		return catalog?.[depName] ?? null;
	}

	const updates: UpdateMap = {};

	for (const proj of projects) {
		const pkgJsonPath = path.join(proj.path, 'package.json');
		if (!fs.existsSync(pkgJsonPath))
			continue;

		let pkg: PackageJson | null = null;
		try {
			const pj = fs.readFileSync(pkgJsonPath, 'utf8');
			pkg = JSON.parse(pj) as PackageJson;
		}
		catch {
			continue;
		}

		const depBlocks: DepRecord[] = [
			pkg.dependencies,
			pkg.devDependencies,
			pkg.peerDependencies,
			pkg.optionalDependencies,
		];

		for (const rec of depBlocks) {
			if (!rec)
				continue;

			for (const [ depName, depSpec ] of Object.entries(rec)) {
				let entry: UpdateEntry | null = null;
				if (typeof depSpec === 'string' && depSpec.startsWith('workspace:')) {
					const to = resolveWorkspaceSpec(depName, depSpec);
					if (to)
						entry = { from: depSpec, to, reason: 'workspace' };
				}
				else if (typeof depSpec === 'string' && depSpec.startsWith('catalog:')) {
					const to = resolveCatalogSpec(depName, depSpec);
					if (to)
						entry = { from: depSpec, to, reason: 'catalog' };
				}
				if (entry) {
					const key = pkg?.name ?? proj.name; // prefer the package.json name
					if (!updates[key])
						updates[key] = {};

					updates[key][depName] = entry;
				}
			}
		}
	}

	const simple: Record<string, Record<string, string>> = {};
	for (const [ pkgName, entries ] of Object.entries(updates)) {
		for (const [ depName, entry ] of Object.entries(entries))
			(simple[pkgName] ||= {})[depName] = entry.to;
	}

	const stringified = JSON.stringify(simple);
	if (stringified.length > 65536)
		throw new Error('Output too large for a GitHub Action output (over 65536 characters)');

	// Print only the final version map
	console.log(stringified);

	return stringified;
}