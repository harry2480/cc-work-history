import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { type ICruiseResult, cruise } from 'dependency-cruiser';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const config = createRequire(__filename)(resolve(root, '.dependency-cruiser.cjs'));

async function cruiseDir(dir: string): Promise<ICruiseResult> {
	const reporterOutput = await cruise(
		[resolve(root, dir)],
		{ ...config.options, ruleSet: { forbidden: config.forbidden }, validate: true },
		undefined,
		{ tsConfig: extractTSConfig(resolve(root, 'tsconfig.web.json')) },
	);
	return reporterOutput.output as ICruiseResult;
}

function violatedRules(result: ICruiseResult): string[] {
	return [...new Set(result.summary.violations.map((v) => v.rule.name))].sort();
}

describe('.dependency-cruiser.cjs', () => {
	it('現在のソース（src/）に違反がない', async () => {
		const result = await cruiseDir('src');
		expect(result.summary.violations).toEqual([]);
	});

	it('違反を含むフィクスチャで、すべてのルールが違反を検出する', async () => {
		const result = await cruiseDir('test/fixtures/dependency-violations/src');
		expect(violatedRules(result)).toEqual(
			config.forbidden.map((rule: { name: string }) => rule.name).sort(),
		);
	});
});
