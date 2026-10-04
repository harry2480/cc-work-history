import { describe, expect, it } from 'vitest';
import { StubSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-session-log.adapter';

const entry = { timestamp: new Date(0), role: 'user' as const, inputTokens: 0, outputTokens: 0 };

describe('StubSessionLogAdapter', () => {
	const adapter = new StubSessionLogAdapter([
		{ projectId: 'b', sessionId: 's2', entries: [entry] },
		{ projectId: 'a', sessionId: 's1', entries: [entry, entry] },
		{ projectId: 'a', sessionId: 's3', entries: [] },
	]);

	it('渡されたセッションをプロジェクト単位で返す', async () => {
		expect(await adapter.listProjectIds()).toEqual(['a', 'b']);
		expect((await adapter.listSessionFiles('a')).map((f) => f.sessionId)).toEqual(['s1', 's3']);
	});

	it('セッションのエントリを返す', async () => {
		const [file] = await adapter.listSessionFiles('a');
		if (!file) throw new Error('not found');

		expect(await adapter.readEntries(file)).toHaveLength(2);
	});
});
