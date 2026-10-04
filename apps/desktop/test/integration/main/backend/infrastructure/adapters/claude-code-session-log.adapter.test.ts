import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { ClaudeCodeSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/claude-code-session-log.adapter';

const rootDir = resolve(__dirname, '../../../../../fixtures/claude-projects');
const adapter = new ClaudeCodeSessionLogAdapter(rootDir);
const projectId = '-Users-me-repo-app';
const sessionId = '11111111-1111-4111-8111-111111111111';

async function readFixtureSession() {
	const [file] = await adapter.listSessionFiles(projectId);
	if (!file) throw new Error('fixture not found');
	return { file, entries: await adapter.readEntries(file) };
}

describe('ClaudeCodeSessionLogAdapter', () => {
	it('ルート直下のディレクトリをプロジェクトとして返す', async () => {
		expect(await adapter.listProjectIds()).toEqual(['-Users-me-repo-app', '-Users-me-repo-other']);
	});

	it('プロジェクト内の .jsonl だけをセッションファイルとして返す', async () => {
		const files = await adapter.listSessionFiles(projectId);

		expect(files).toHaveLength(1);
		expect(files[0]).toMatchObject({
			projectId,
			sessionId,
			path: join(rootDir, projectId, `${sessionId}.jsonl`),
		});
		expect(files[0]?.sizeBytes).toBeGreaterThan(0);
		expect(files[0]?.modifiedAt).toBeInstanceOf(Date);
	});

	it('user / assistant 行だけを取り出し、対象外の行・壊れた行はスキップする', async () => {
		const { entries } = await readFixtureSession();

		expect(entries.map((e) => [e.timestamp.toISOString(), e.role])).toEqual([
			['2026-10-01T09:00:00.000Z', 'user'],
			['2026-10-01T09:00:05.000Z', 'assistant'],
			['2026-10-01T09:00:10.000Z', 'user'],
			['2026-10-01T09:00:12.000Z', 'assistant'],
			['2026-10-01T09:40:00.000Z', 'assistant'],
		]);
	});

	it('assistant のモデル・トークン数を取り出し、同じ message.id の重複行は 1 件として数える', async () => {
		const { entries } = await readFixtureSession();
		const assistants = entries.filter((e) => e.role === 'assistant');

		expect(assistants.map((e) => [e.model, e.inputTokens, e.outputTokens])).toEqual([
			// input_tokens + キャッシュ作成 + キャッシュ読み込み
			['claude-opus-5-5', 1110, 20],
			// <synthetic> はモデルとして扱わない
			[undefined, 0, 0],
			// usage がない行は 0
			['claude-sonnet-5-5', 0, 0],
		]);
	});

	it('作業ディレクトリを取り出す', async () => {
		const { entries } = await readFixtureSession();

		expect(entries[0]?.cwd).toBe('/Users/me/repo/app');
	});

	it('取り出したエントリからセッションを組み立てられる', async () => {
		const { entries } = await readFixtureSession();
		const result = Session.fromLogEntries({ id: sessionId, projectId, entries });

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.value.messageCount).toBe(5);
		expect(result.value.models).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5']);
		expect(result.value.activities).toHaveLength(2);
	});

	it('ルートディレクトリが存在しない場合は空を返す', async () => {
		const missing = new ClaudeCodeSessionLogAdapter(join(rootDir, 'does-not-exist'));

		expect(await missing.listProjectIds()).toEqual([]);
		expect(await missing.listSessionFiles('x')).toEqual([]);
	});
});
