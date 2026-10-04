import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClaudeCliSummaryAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/claude-cli-summary.adapter';

const fakeClaude = resolve(__dirname, '../../../../../fixtures/fake-claude/claude');
const input = {
	projectName: 'app',
	conversation: 'ユーザー: README の誤字を直して\nアシスタント: 2 箇所直しました',
};

let dir: string;
let record: string;

function adapter(
	mode: string,
	options: { timeoutMs?: number; maxConversationLength?: number } = {},
) {
	return new ClaudeCliSummaryAdapter({
		command: fakeClaude,
		env: { ...process.env, FAKE_CLAUDE_MODE: mode, FAKE_CLAUDE_RECORD: record },
		...options,
	});
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-cli-'));
	record = join(dir, 'record.json');
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe('ClaudeCliSummaryAdapter', () => {
	it('構造化出力から概要とタグを取り出し、空白・重複・空・文字列以外を除いて最大 5 個にする', async () => {
		expect(await adapter('ok').generate(input)).toEqual({
			status: 'ok',
			value: { summary: 'README の誤字を修正した。', tags: ['README', '誤字修正', 'a', 'b', 'c'] },
		});
	});

	it('セッションを保存せず、ツール・ユーザー設定・MCP・フックを使わない引数で呼び、会話は標準入力で渡す', async () => {
		await adapter('ok').generate(input);
		const { args, stdin } = JSON.parse(readFileSync(record, 'utf-8'));

		expect(args).toContain('-p');
		expect(args).toContain('--no-session-persistence');
		expect(args).toContain('--strict-mcp-config');
		expect(args[args.indexOf('--tools') + 1]).toBe('');
		expect(args[args.indexOf('--setting-sources') + 1]).toBe('');
		expect(JSON.parse(args[args.indexOf('--settings') + 1])).toEqual({ disableAllHooks: true });
		expect(JSON.parse(args[args.indexOf('--json-schema') + 1]).required).toEqual([
			'summary',
			'tags',
		]);
		expect(stdin).toContain('プロジェクト: app');
		expect(stdin).toContain('README の誤字を直して');
	});

	it('会話が長すぎる場合は冒頭と末尾を残して中央を省略する', async () => {
		const conversation = `${'A'.repeat(100)}${'B'.repeat(100)}${'C'.repeat(100)}`;
		await adapter('ok', { maxConversationLength: 100 }).generate({
			projectName: 'app',
			conversation,
		});
		const { stdin } = JSON.parse(readFileSync(record, 'utf-8'));

		expect(stdin).toContain(`${'A'.repeat(50)}\n\n（中略）\n\n${'C'.repeat(50)}`);
		expect(stdin).not.toContain('B');
	});

	it.each([
		['not-json', /JSON ではありません/],
		['is-error', /エラーを返しました: rate limited/],
		['bad-shape', /形式が不正/],
		['exit-1', /終了コード 1: something went wrong/],
	])('CLI の応答が %s の場合は failed を返す', async (mode, reason) => {
		const result = await adapter(mode).generate(input);

		expect(result.status).toBe('failed');
		expect(result.status === 'failed' && result.reason).toMatch(reason);
	});

	it('タイムアウトしたら子プロセスを止めて failed を返す', async () => {
		const started = Date.now();
		const result = await adapter('hang', { timeoutMs: 300 }).generate(input);

		expect(result).toEqual({ status: 'failed', reason: 'タイムアウトしました（300ms）' });
		expect(Date.now() - started).toBeLessThan(5000);
	});

	it('実行ファイルが存在しない場合は例外を投げず unavailable を返す', async () => {
		const missing = new ClaudeCliSummaryAdapter({ command: join(dir, 'no-such-claude') });

		expect((await missing.generate(input)).status).toBe('unavailable');
	});

	it('PATH にも一般的なインストール先にも CLI がなければ unavailable を返す', async () => {
		const notInstalled = new ClaudeCliSummaryAdapter({ env: { PATH: dir, HOME: dir } });
		// 一般的なインストール先（/opt/homebrew/bin など）にある環境では、この確認は行わない
		const result = await notInstalled.generate(input);
		if (result.status !== 'unavailable') return;

		expect(result.reason).toBe('Claude CLI が見つかりません');
	});

	it('CC_WORK_HISTORY_CLAUDE_PATH で実行ファイルを指定できる', async () => {
		const configured = new ClaudeCliSummaryAdapter({
			env: { ...process.env, CC_WORK_HISTORY_CLAUDE_PATH: fakeClaude, FAKE_CLAUDE_MODE: 'ok' },
		});

		expect((await configured.generate(input)).status).toBe('ok');
	});
});
