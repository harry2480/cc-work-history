import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type {
	ResumeTarget,
	TerminalLaunchResult,
	TerminalLauncherGateway,
} from '../../domain/gateways/terminal-launcher.gateway';

/** Claude Code のセッション ID（UUID）。`--xxx` のようなオプションとして読まれる値を通さない */
const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * ターミナルに打ち込むと危ない文字を含むか。
 * Terminal.app の do script は文字列をキー入力としてシェルに送るため、クォートの中でも
 * 制御文字（Ctrl-U・改行など）が効いてしまう。バックスラッシュは fish でクォートを破れる
 */
function hasUnsafeChar(path: string): boolean {
	for (const char of path) {
		const code = char.codePointAt(0) ?? 0;
		if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
		if (code === 0x2028 || code === 0x2029 || char === '\\') return true;
	}
	return false;
}
const TIMEOUT_MS = 10_000;

type Options = {
	platform?: NodeJS.Platform;
	/** テスト用。osascript の代わりに実行する */
	runAppleScript?: (script: string) => Promise<void>;
};

/** シェルの引数として安全な形（シングルクォートで囲む） */
export function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

/** AppleScript の文字列リテラルにする */
function appleScriptString(value: string): string {
	return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

/** Terminal.app の新しいウィンドウで実行する AppleScript */
export function resumeScript({ cwd, sessionId }: ResumeTarget): string {
	const command = `cd -- ${shellQuote(cwd)} && claude -r ${shellQuote(sessionId)}`;
	return [
		'tell application "Terminal"',
		'activate',
		`do script ${appleScriptString(command)}`,
		'end tell',
	].join('\n');
}

function runOsascript(script: string): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile('osascript', ['-e', script], { timeout: TIMEOUT_MS }, (error) =>
			error ? reject(error) : resolve(),
		);
	});
}

/** macOS の Terminal.app を開いてセッションを再開する。他の OS は未対応 */
export class MacosTerminalLauncherAdapter implements TerminalLauncherGateway {
	private readonly platform: NodeJS.Platform;
	private readonly runAppleScript: (script: string) => Promise<void>;

	constructor(options: Options = {}) {
		this.platform = options.platform ?? process.platform;
		this.runAppleScript = options.runAppleScript ?? runOsascript;
	}

	async resume(target: ResumeTarget): Promise<TerminalLaunchResult> {
		if (this.platform !== 'darwin') {
			return {
				status: 'unsupported',
				reason: 'セッションの再開は今のところ macOS だけに対応しています',
			};
		}
		if (!SESSION_ID_PATTERN.test(target.sessionId)) {
			return { status: 'failed', reason: 'セッション ID の形式が不正です' };
		}
		if (!isAbsolute(target.cwd)) {
			return { status: 'failed', reason: `作業ディレクトリが分かりません: ${target.cwd}` };
		}
		if (hasUnsafeChar(target.cwd)) {
			return {
				status: 'failed',
				reason: '作業ディレクトリのパスに、ターミナルで安全に扱えない文字が含まれています',
			};
		}
		if (!(await isDirectory(target.cwd))) {
			return { status: 'failed', reason: `作業ディレクトリが見つかりません: ${target.cwd}` };
		}
		try {
			await this.runAppleScript(resumeScript(target));
			return { status: 'ok' };
		} catch (error) {
			return { status: 'failed', reason: `ターミナルを開けませんでした: ${String(error)}` };
		}
	}
}

async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}
