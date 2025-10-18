import * as core from '@actions/core';
import { pnpmToSemver } from './pnpm-to-semver.ts';


const toList = (value: string | undefined): string[] | undefined => {
	const list = value?.split(',').map(s => s.trim()).filter(s => s);

	return list.length > 0 ? list : undefined;
}


try {
	const include = core.getInput('include');
	const exclude = core.getInput('exclude');

	const semverMap = pnpmToSemver({
		include: toList(include),
		exclude: toList(exclude),
	});

	core.setOutput('dep-map', semverMap);
}
catch (error) {
	core.setFailed(error instanceof Error ? error.message : String(error));
}