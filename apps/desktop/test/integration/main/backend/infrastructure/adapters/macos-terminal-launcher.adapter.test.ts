import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	MacosTerminalLauncherAdapter,
	resumeScript,
	shellQuote,
} from '../../../../../../src/main/backend/infrastructure/adapters/macos-terminal-launcher.adapter';

const SESSION_ID = '11111111-1111-4111-8111-111111111111';
let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

/** AppleScript の文字列リテラルを元の文字列に戻す（テスト用） */
function unquoteAppleScript(literal: string): string {
	return literal.slice(1, -1).replace(/\\(.)/g, '$1');
}

describe('MacosTerminalLauncherAdapter', () => {
	it('作業ディレクトリで claude -r を実行する AppleScript を Terminal に渡す', async () => {
		const runAppleScript = vi.fn(async (_script: string) => {});
		const adapter = new MacosTerminalLauncherAdapter({ platform: 'darwin', runAppleScript });

		expect(await adapter.resume({ cwd: dir, sessionId: SESSION_ID })).toEqual({ status: 'ok' });
		expect(runAppleScript).toHaveBeenCalledWith(resumeScript({ cwd: dir, sessionId: SESSION_ID }));
		expect(runAppleScript.mock.calls[0]?.[0]).toContain('tell application "Terminal"');
	});

	it('パスに空白・引用符があっても、シェルのコマンドが崩れない', () => {
		const cwd = join(dir, `a b'c"d`);
		const script = resumeScript({ cwd, sessionId: SESSION_ID });
		const literal = script.match(/do script (".*")$/m)?.[1] ?? '';

		expect(unquoteAppleScript(literal)).toBe(
			`cd -- ${shellQuote(cwd)} && claude -r '${SESSION_ID}'`,
		);
		expect(shellQuote(`a'b`)).toBe(`'a'\\''b'`);
	});

	it('パスに特殊文字があるディレクトリでも開ける', async () => {
		const cwd = join(dir, `a b'c`);
		mkdirSync(cwd);
		const adapter = new MacosTerminalLauncherAdapter({
			platform: 'darwin',
			runAppleScript: async () => {},
		});

		expect(await adapter.resume({ cwd, sessionId: SESSION_ID })).toEqual({ status: 'ok' });
	});

	it('macOS 以外は未対応として、何も実行しない', async () => {
		const runAppleScript = vi.fn(async (_script: string) => {});
		const adapter = new MacosTerminalLauncherAdapter({ platform: 'linux', runAppleScript });

		const result = await adapter.resume({ cwd: dir, sessionId: SESSION_ID });

		expect(result.status).toBe('unsupported');
		expect(runAppleScript).not.toHaveBeenCalled();
	});

	it('作業ディレクトリがなければ失敗にする', async () => {
		const runAppleScript = vi.fn(async (_script: string) => {});
		const adapter = new MacosTerminalLauncherAdapter({ platform: 'darwin', runAppleScript });

		const result = await adapter.resume({ cwd: join(dir, 'missing'), sessionId: SESSION_ID });

		expect(result).toEqual({
			status: 'failed',
			reason: expect.stringContaining('作業ディレクトリが見つかりません'),
		});
		expect(runAppleScript).not.toHaveBeenCalled();
	});

	it.each(['x; echo injected', '--dangerously-skip-permissions', 'not-a-uuid'])(
		'UUID でないセッション ID「%s」では実行しない',
		async (sessionId) => {
			const runAppleScript = vi.fn(async (_script: string) => {});
			const adapter = new MacosTerminalLauncherAdapter({ platform: 'darwin', runAppleScript });

			const result = await adapter.resume({ cwd: dir, sessionId });

			expect(result.status).toBe('failed');
			expect(runAppleScript).not.toHaveBeenCalled();
		},
	);

	it.each([
		['Ctrl-U と改行', 'x\u0015echo injected\n'],
		['改行', 'x\necho injected'],
		['C1 制御文字', 'x\u009b'],
		['行区切り文字', 'x\u2028'],
		['バックスラッシュ（fish でクォートを破れる）', "x\\'"],
	])(
		'作業ディレクトリのパスに%sがあれば、ディレクトリがあっても実行しない',
		async (_label, name) => {
			const cwd = join(dir, name);
			mkdirSync(cwd);
			const runAppleScript = vi.fn(async (_script: string) => {});
			const adapter = new MacosTerminalLauncherAdapter({ platform: 'darwin', runAppleScript });

			const result = await adapter.resume({ cwd, sessionId: SESSION_ID });

			expect(result).toEqual({
				status: 'failed',
				reason: expect.stringContaining('安全に扱えない文字'),
			});
			expect(runAppleScript).not.toHaveBeenCalled();
		},
	);

	it('相対パス（作業ディレクトリが分からずプロジェクト名で代わりにした場合など）では実行しない', async () => {
		const runAppleScript = vi.fn(async (_script: string) => {});
		const adapter = new MacosTerminalLauncherAdapter({ platform: 'darwin', runAppleScript });

		const result = await adapter.resume({ cwd: '-Users-me-repo-app', sessionId: SESSION_ID });

		expect(result).toEqual({
			status: 'failed',
			reason: expect.stringContaining('作業ディレクトリが分かりません'),
		});
		expect(runAppleScript).not.toHaveBeenCalled();
	});

	it('osascript が失敗したら失敗にする', async () => {
		const adapter = new MacosTerminalLauncherAdapter({
			platform: 'darwin',
			runAppleScript: async () => {
				throw new Error('not authorized');
			},
		});

		const result = await adapter.resume({ cwd: dir, sessionId: SESSION_ID });

		expect(result).toEqual({ status: 'failed', reason: expect.stringContaining('not authorized') });
	});
});
