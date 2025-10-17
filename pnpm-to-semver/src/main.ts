import { pnpmToSemver } from './pnpm-to-semver.ts';


const toList = (envVar: string | undefined): string[] | undefined =>
	envVar?.split(',').map(s => s.trim()).filter(s => s)


const semverMap = pnpmToSemver({
	include: toList(process.env.PNPM_TO_SEMVER_INCLUDE),
	exclude: toList(process.env.PNPM_TO_SEMVER_EXCLUDE),
});