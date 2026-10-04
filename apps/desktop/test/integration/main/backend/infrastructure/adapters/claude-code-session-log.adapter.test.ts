import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
		expect(result.value.todos.items.map((t) => [t.content, t.status])).toEqual([
			['（テスト用の作業 1）', 'completed'],
			['（テスト用の作業 2）', 'in_progress'],
			['（テスト用の作業 3）', 'pending'],
		]);
	});

	it('TodoWrite の作業リストを、重複行に記録されたものも含めてメッセージごとに取り出す', async () => {
		const { entries } = await readFixtureSession();

		expect(entries.map((e) => e.todos?.map((t) => t.status))).toEqual([
			undefined,
			['in_progress', 'pending'],
			undefined,
			undefined,
			// 文字列の content / status を持たない項目は捨てる（状態の検証はドメインで行う）
			['completed', 'in_progress', 'unknown', 'pending', 'pending'],
		]);
	});

	describe('TodoWrite の取り出し', () => {
		const assistant = (id: string, content: unknown[], extra: Record<string, unknown> = {}) =>
			JSON.stringify({
				type: 'assistant',
				timestamp: '2026-10-01T09:00:00.000Z',
				...extra,
				message: { id, role: 'assistant', content },
			});
		const todoWrite = (todos: unknown) => ({
			type: 'tool_use',
			name: 'TodoWrite',
			input: { todos },
		});

		async function readLines(lines: string[]) {
			const dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
			try {
				mkdirSync(join(dir, 'p'));
				writeFileSync(join(dir, 'p', 's.jsonl'), `${lines.join('\n')}\n`);
				const tmpAdapter = new ClaudeCodeSessionLogAdapter(dir);
				const [file] = await tmpAdapter.listSessionFiles('p');
				if (!file) throw new Error('file not found');
				return await tmpAdapter.readEntries(file);
			} finally {
				rmSync(dir, { recursive: true, force: true });
			}
		}

		it('1 つのメッセージに複数の呼び出しがあれば最後のものを使う', async () => {
			const entries = await readLines([
				assistant('m1', [
					todoWrite([{ content: 'a', status: 'pending' }]),
					{
						type: 'tool_use',
						name: 'Read',
						input: { todos: [{ content: 'x', status: 'pending' }] },
					},
					todoWrite([{ content: 'b', status: 'completed' }]),
				]),
			]);

			expect(entries[0]?.todos).toEqual([{ content: 'b', status: 'completed' }]);
		});

		it('空のリストを書き込んだら空配列、todos が配列でなければ呼び出しを無視する', async () => {
			const entries = await readLines([
				assistant('m1', [todoWrite([])]),
				assistant('m2', [todoWrite('not-an-array')]),
				assistant('m3', [{ type: 'tool_use', name: 'TodoWrite' }]),
			]);

			expect(entries.map((e) => e.todos)).toEqual([[], undefined, undefined]);
		});

		it('サブエージェント（isSidechain）の作業リストは取り出さない', async () => {
			const entries = await readLines([
				assistant('m1', [todoWrite([{ content: 'a', status: 'pending' }])], {
					isSidechain: true,
				}),
			]);

			expect(entries).toHaveLength(1);
			expect(entries[0]?.todos).toBeUndefined();
		});
	});

	it('ルートディレクトリが存在しない場合は空を返す', async () => {
		const missing = new ClaudeCodeSessionLogAdapter(join(rootDir, 'does-not-exist'));

		expect(await missing.listProjectIds()).toEqual([]);
		expect(await missing.listSessionFiles('x')).toEqual([]);
	});
});
