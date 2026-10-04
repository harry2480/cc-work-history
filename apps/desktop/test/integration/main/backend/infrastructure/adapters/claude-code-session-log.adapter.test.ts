import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SessionLogEntry } from '../../../../../../src/main/backend/domain/models/session-log-entry.model';
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

		expect(
			entries.map((e) =>
				e.todoEvents?.map((ev) => (ev.kind === 'todo-write' ? ev.todos.map((t) => t.status) : ev)),
			),
		).toEqual([
			undefined,
			[['in_progress', 'pending']],
			undefined,
			undefined,
			// 文字列の content / status を持たない項目は捨てる（状態の検証はドメインで行う）
			[['completed', 'in_progress', 'unknown', 'pending', 'pending']],
		]);
	});

	describe('作業リストの操作の取り出し（架空の JSONL）', () => {
		let seq = 0;
		const at = () => new Date(Date.UTC(2026, 9, 1, 9, 0, seq++)).toISOString();
		const assistant = (id: string, content: unknown[], extra: Record<string, unknown> = {}) =>
			JSON.stringify({
				type: 'assistant',
				timestamp: at(),
				...extra,
				message: { id, role: 'assistant', content },
			});
		const user = (content: unknown[], extra: Record<string, unknown> = {}) =>
			JSON.stringify({
				type: 'user',
				timestamp: at(),
				...extra,
				message: { role: 'user', content },
			});
		const todoWrite = (todos: unknown) => ({
			type: 'tool_use',
			name: 'TodoWrite',
			input: { todos },
		});
		const toolUse = (id: string, name: string, input: unknown) => ({
			type: 'tool_use',
			id,
			name,
			input,
		});
		const toolResult = (id: string, content: unknown = '（結果）', extra = {}) => ({
			type: 'tool_result',
			tool_use_id: id,
			content,
			...extra,
		});
		/** TaskCreate の呼び出しと、ID を割り振った結果の 2 行 */
		const taskCreate = (useId: string, taskId: string, subject: string) => [
			assistant(`m-${useId}`, [toolUse(useId, 'TaskCreate', { subject, description: '（説明）' })]),
			user([toolResult(useId, `Task #${taskId} created successfully: ${subject}`)], {
				toolUseResult: { task: { id: taskId, subject } },
			}),
		];
		const taskUpdate = (
			useId: string,
			input: unknown,
			toolUseResult: unknown = { success: true },
		) => [
			assistant(`m-${useId}`, [toolUse(useId, 'TaskUpdate', input)]),
			user([toolResult(useId, '（更新しました）')], { toolUseResult }),
		];
		const eventsOf = (entries: SessionLogEntry[]) => entries.flatMap((e) => e.todoEvents ?? []);

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

		it('1 つのメッセージの複数の TodoWrite を記録順に取り出す', async () => {
			const entries = await readLines([
				assistant('m1', [
					todoWrite([{ content: 'a', status: 'pending' }]),
					toolUse('x', 'Read', { todos: [{ content: 'x', status: 'pending' }] }),
					todoWrite([{ content: 'b', status: 'completed' }]),
				]),
			]);

			expect(entries[0]?.todoEvents).toEqual([
				{ kind: 'todo-write', todos: [{ content: 'a', status: 'pending' }] },
				{ kind: 'todo-write', todos: [{ content: 'b', status: 'completed' }] },
			]);
		});

		it('空のリストの TodoWrite は取り出し、todos が配列でない呼び出しは無視する', async () => {
			const entries = await readLines([
				assistant('m1', [todoWrite([])]),
				assistant('m2', [todoWrite('not-an-array')]),
				assistant('m3', [{ type: 'tool_use', name: 'TodoWrite' }]),
			]);

			expect(entries.map((e) => e.todoEvents)).toEqual([
				[{ kind: 'todo-write', todos: [] }],
				undefined,
				undefined,
			]);
		});

		it('TaskCreate は結果に記録された ID と組み合わせ、TaskUpdate は入力のフィールドを取り出す', async () => {
			const entries = await readLines([
				...taskCreate('u1', '1', 'a'),
				...taskCreate('u2', '2', 'b'),
				...taskUpdate('u3', { taskId: '1', status: 'in_progress' }),
				...taskUpdate('u4', { taskId: 2, subject: 'b2', status: 'deleted', owner: 'x' }),
			]);

			expect(eventsOf(entries)).toEqual([
				{ kind: 'task-create', taskId: '1', subject: 'a' },
				{ kind: 'task-create', taskId: '2', subject: 'b' },
				{ kind: 'task-update', taskId: '1', status: 'in_progress' },
				{ kind: 'task-update', taskId: '2', subject: 'b2', status: 'deleted' },
			]);
			// 操作は結果（user 行）の時点に記録する。メッセージ数は変わらない
			expect(entries).toHaveLength(8);
			expect(entries[1]?.role).toBe('user');
			expect(entries[1]?.todoEvents).toHaveLength(1);
		});

		it('toolUseResult がなければ結果の本文から ID を読む', async () => {
			const entries = await readLines([
				assistant('m1', [toolUse('u1', 'TaskCreate', { subject: 'a' })]),
				user([toolResult('u1', [{ type: 'text', text: 'Task #7 created successfully: a' }])]),
			]);

			expect(eventsOf(entries)).toEqual([{ kind: 'task-create', taskId: '7', subject: 'a' }]);
		});

		it('失敗した呼び出し・結果のない呼び出し・ID の分からない呼び出し・壊れた入力は無視する', async () => {
			const entries = await readLines([
				// エラーになった作成
				assistant('m1', [toolUse('u1', 'TaskCreate', { subject: 'a' })]),
				user([toolResult('u1', 'エラー', { is_error: true })]),
				// 結果が記録されていない作成
				assistant('m2', [toolUse('u2', 'TaskCreate', { subject: 'b' })]),
				// ID が分からない作成
				assistant('m3', [toolUse('u3', 'TaskCreate', { subject: 'c' })]),
				user([toolResult('u3', '（不明な結果）')]),
				// 件名がない作成
				assistant('m4', [toolUse('u4', 'TaskCreate', { description: 'd' })]),
				user([toolResult('u4')], { toolUseResult: { task: { id: '4' } } }),
				// success: false の更新・taskId がない更新・入力がオブジェクトでない更新
				...taskUpdate('u5', { taskId: '1', status: 'completed' }, { success: false }),
				...taskUpdate('u6', { status: 'completed' }),
				assistant('m7', [toolUse('u7', 'TaskUpdate', 'broken')]),
				user([toolResult('u7')]),
				// 呼び出しのない結果
				user([toolResult('unknown')], { toolUseResult: { task: { id: '9', subject: 'z' } } }),
			]);

			expect(eventsOf(entries)).toEqual([]);
		});

		it('1 行に複数の結果があるときは toolUseResult を使わず、本文から ID を読む', async () => {
			const entries = await readLines([
				assistant('m1', [
					toolUse('u1', 'TaskCreate', { subject: 'a' }),
					toolUse('u2', 'TaskCreate', { subject: 'b' }),
				]),
				user([toolResult('u1', 'Task #1 created successfully: a'), toolResult('u2', '（不明）')], {
					toolUseResult: { task: { id: '2', subject: 'b' } },
				}),
			]);

			expect(eventsOf(entries)).toEqual([{ kind: 'task-create', taskId: '1', subject: 'a' }]);
		});

		it('サブエージェント（isSidechain）の作業リストの操作は取り出さない', async () => {
			const sidechain = { isSidechain: true };
			const entries = await readLines([
				assistant('m1', [todoWrite([{ content: 'a', status: 'pending' }])], sidechain),
				assistant('m2', [toolUse('u1', 'TaskCreate', { subject: 'a' })], sidechain),
				user([toolResult('u1')], {
					...sidechain,
					toolUseResult: { task: { id: '1', subject: 'a' } },
				}),
			]);

			expect(entries).toHaveLength(3);
			expect(eventsOf(entries)).toEqual([]);
		});

		it('取り出した操作からセッション終了時点のチェックリストを組み立てられる', async () => {
			const entries = await readLines([
				...taskCreate('u1', '1', 'a'),
				...taskCreate('u2', '2', 'b'),
				...taskUpdate('u3', { taskId: '1', status: 'completed' }),
			]);
			const result = Session.fromLogEntries({ id: 's', projectId: 'p', entries });

			expect(result.success && result.value.todos.items.map((t) => [t.content, t.status])).toEqual([
				['a', 'completed'],
				['b', 'pending'],
			]);
		});
	});

	it('ルートディレクトリが存在しない場合は空を返す', async () => {
		const missing = new ClaudeCodeSessionLogAdapter(join(rootDir, 'does-not-exist'));

		expect(await missing.listProjectIds()).toEqual([]);
		expect(await missing.listSessionFiles('x')).toEqual([]);
	});
});
