import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeCodeSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/claude-code-session-log.adapter';

const SESSION_ID = '33333333-3333-4333-8333-333333333333';
let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

const user = (content: unknown, extra: Record<string, unknown> = {}) => ({
	type: 'user',
	timestamp: '2026-10-01T09:00:00.000Z',
	message: { role: 'user', content },
	...extra,
});
const assistant = (id: string, content: unknown[], extra: Record<string, unknown> = {}) => ({
	type: 'assistant',
	timestamp: '2026-10-01T09:00:01.000Z',
	message: { id, role: 'assistant', content },
	...extra,
});

async function readConversation(records: unknown[]) {
	const projectDir = join(dir, '-Users-me-repo-app');
	mkdirSync(projectDir, { recursive: true });
	writeFileSync(
		join(projectDir, `${SESSION_ID}.jsonl`),
		`${records.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n')}\n`,
	);
	const adapter = new ClaudeCodeSessionLogAdapter(dir);
	const [file] = await adapter.listSessionFiles('-Users-me-repo-app');
	if (!file) throw new Error('fixture');
	return adapter.readConversation(file);
}

describe('ClaudeCodeSessionLogAdapter.readConversation', () => {
	it('一覧を取ったあとにファイルが消えていたら null', async () => {
		const adapter = new ClaudeCodeSessionLogAdapter(dir);
		expect(
			await adapter.readConversation({
				projectId: 'p',
				sessionId: SESSION_ID,
				path: join(dir, 'p', `${SESSION_ID}.jsonl`),
				modifiedAt: new Date(0),
				sizeBytes: 0,
			}),
		).toBeNull();
	});

	it('ユーザーとアシスタントの発言のテキストだけを時系列で取り出す', async () => {
		const messages = await readConversation([
			user('README の誤字を直して'),
			assistant('m1', [{ type: 'thinking', thinking: '考え中' }]),
			assistant('m1', [{ type: 'text', text: '確認します' }]),
			assistant('m1', [{ type: 'tool_use', name: 'Read', input: { path: 'README.md' } }]),
			user([{ type: 'tool_result', tool_use_id: 't1', content: 'ファイルの中身' }]),
			assistant('m2', [{ type: 'text', text: '直しました' }]),
			user([{ type: 'text', text: 'ありがとう' }]),
		]);

		expect(messages).toEqual([
			{ role: 'user', text: 'README の誤字を直して' },
			{ role: 'assistant', text: '確認します' },
			{ role: 'assistant', text: '直しました' },
			{ role: 'user', text: 'ありがとう' },
		]);
	});

	it('メタ情報・サブエージェント・コマンドのタグ・壊れた行・重複した行は含めない', async () => {
		const messages = await readConversation([
			user('メタ', { isMeta: true }),
			user('サブエージェントへの指示', { isSidechain: true }),
			assistant('s1', [{ type: 'text', text: 'サブエージェントの応答' }], { isSidechain: true }),
			user('<command-name>/clear</command-name>'),
			user('<local-command-stdout></local-command-stdout>'),
			'{broken',
			{ type: 'system', content: 'システム' },
			user('本当の依頼'),
			assistant('m1', [{ type: 'text', text: '応答' }]),
			assistant('m1', [{ type: 'text', text: '応答' }]),
		]);

		expect(messages).toEqual([
			{ role: 'user', text: '本当の依頼' },
			{ role: 'assistant', text: '応答' },
		]);
	});

	it('compact の要約・通知・API エラー・中断の記録は含めず、コマンドの引数は残す', async () => {
		const messages = await readConversation([
			user('This session is being continued from a previous conversation...', {
				isCompactSummary: true,
			}),
			user('要約の表示用', { isVisibleInTranscriptOnly: true }),
			user('<task-notification>完了しました</task-notification>', {
				origin: { kind: 'task-notification' },
			}),
			user('<command-name>/goal</command-name><command-args>全 Issue に着手して</command-args>', {
				origin: { kind: 'human' },
			}),
			user('<bash-input>pnpm verify</bash-input><bash-stdout>ok</bash-stdout>'),
			user('[Request interrupted by user]'),
			assistant('e1', [{ type: 'text', text: 'API Error: 500' }], { isApiErrorMessage: true }),
			{
				type: 'assistant',
				timestamp: '2026-10-01T09:00:02.000Z',
				message: {
					id: 'e2',
					model: '<synthetic>',
					content: [{ type: 'text', text: 'No response' }],
				},
			},
			assistant('m1', [{ type: 'text', text: '着手します' }]),
		]);

		expect(messages).toEqual([
			{ role: 'user', text: '全 Issue に着手して' },
			{ role: 'user', text: 'pnpm verify' },
			{ role: 'assistant', text: '着手します' },
		]);
	});
});
