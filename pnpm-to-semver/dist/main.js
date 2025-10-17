import fs from "node:fs";
import path from "node:path";

//#region src/pnpm-to-semver.ts
function pnpmToSemver(projectFilter) {
	const statePath = path.resolve(process.cwd(), "node_modules", ".pnpm-workspace-state-v1.json");
	const raw = fs.readFileSync(statePath, "utf8");
	const data = JSON.parse(raw);
	const projects = Object.entries(data.projects).filter(([, meta]) => {
		if (projectFilter.include && !projectFilter.include.includes(meta.name)) return false;
		if (projectFilter.exclude && projectFilter.exclude.includes(meta.name)) return false;
		return true;
	}).map(([absPath, meta]) => ({
		path: absPath,
		name: meta.name,
		version: meta.version ?? null
	})).sort((a, b) => a.path.localeCompare(b.path));
	const nameToVersion = /* @__PURE__ */ new Map();
	for (const p of projects) if (p.version) nameToVersion.set(p.name, p.version);
	const catalogs = data.settings?.catalogs ?? {};
	const defaultCatalog = catalogs["default"] ?? {};
	function resolveWorkspaceSpec(depName, spec) {
		const base = nameToVersion.get(depName);
		if (!base) return null;
		const suffix = spec.slice(10).trim();
		let op = "";
		if (suffix === "" || suffix === "*" || suffix === "^") op = "^";
		else if (suffix === "~") op = "~";
		else if (/^[~^]/.test(suffix)) op = suffix[0];
		else if (/^\d/.test(suffix)) op = "";
		return `${op}${base}`;
	}
	function resolveCatalogSpec(depName, spec) {
		const catName = spec.slice(8).trim() || "default";
		return (catalogs[catName] ?? defaultCatalog)?.[depName] ?? null;
	}
	const updates = {};
	for (const proj of projects) {
		const pkgJsonPath = path.join(proj.path, "package.json");
		if (!fs.existsSync(pkgJsonPath)) continue;
		let pkg = null;
		try {
			const pj = fs.readFileSync(pkgJsonPath, "utf8");
			pkg = JSON.parse(pj);
		} catch {
			continue;
		}
		const depBlocks = [
			pkg.dependencies,
			pkg.devDependencies,
			pkg.peerDependencies,
			pkg.optionalDependencies
		];
		for (const rec of depBlocks) {
			if (!rec) continue;
			for (const [depName, depSpec] of Object.entries(rec)) {
				let entry = null;
				if (typeof depSpec === "string" && depSpec.startsWith("workspace:")) {
					const to = resolveWorkspaceSpec(depName, depSpec);
					if (to) entry = {
						from: depSpec,
						to,
						reason: "workspace"
					};
				} else if (typeof depSpec === "string" && depSpec.startsWith("catalog:")) {
					const to = resolveCatalogSpec(depName, depSpec);
					if (to) entry = {
						from: depSpec,
						to,
						reason: "catalog"
					};
				}
				if (entry) {
					const key = pkg?.name ?? proj.name;
					if (!updates[key]) updates[key] = {};
					updates[key][depName] = entry;
				}
			}
		}
	}
	const simple = {};
	for (const [pkgName, entries] of Object.entries(updates)) for (const [depName, entry] of Object.entries(entries)) (simple[pkgName] ||= {})[depName] = entry.to;
	const stringified = JSON.stringify(simple);
	if (stringified.length > 65536) throw new Error("Output too large for a GitHub Action output (over 65536 characters)");
	console.log(stringified);
	return stringified;
}

//#endregion
//#region src/main.ts
const toList = (envVar) => envVar?.split(",").map((s) => s.trim()).filter((s) => s);
pnpmToSemver({
	include: toList(process.env.PNPM_TO_SEMVER_INCLUDE),
	exclude: toList(process.env.PNPM_TO_SEMVER_EXCLUDE)
});

//#endregion
export {  };