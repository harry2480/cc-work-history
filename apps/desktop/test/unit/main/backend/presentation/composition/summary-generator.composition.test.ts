import { describe, expect, it } from 'vitest';
import { ClaudeCliSummaryAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/claude-cli-summary.adapter';
import { StubSummaryGeneratorAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-summary-generator.adapter';
import { createSummaryGenerator } from '../../../../../../src/main/backend/presentation/composition/summary-generator.composition';

describe('createSummaryGenerator', () => {
	it('CC_WORK_HISTORY_STUB_SUMMARY=true なら Stub、それ以外は Claude CLI を使う', async () => {
		const stub = createSummaryGenerator({ CC_WORK_HISTORY_STUB_SUMMARY: 'true' });

		expect(stub).toBeInstanceOf(StubSummaryGeneratorAdapter);
		expect(await stub.generate({ projectName: 'app', conversation: '' })).toMatchObject({
			status: 'ok',
		});
		expect(createSummaryGenerator({})).toBeInstanceOf(ClaudeCliSummaryAdapter);
	});
});
