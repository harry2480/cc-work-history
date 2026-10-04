import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import type { CommitQuery, CommitStatsResult, GitGateway } from '../../domain/gateways/git.gateway';

const TIMEOUT_MS = 15_000;
const MAX_BUFFER = 32 * 1024 * 1024;
const HASH_PATTERN = /^[0-9a-f]{40,64}$/;
/** 各コミットの先頭に付ける目印（ファイル名と区別するため）。git の %x00 で NUL を出力させる */
const COMMIT_MARKER = '\u0000commit:';
const COMMIT_FORMAT = '%x00commit:%H';

type Options = {
	/** git の実行ファイル。既定は PATH 上の git */
	command?: string;
	env?: Record<string, string | undefined>;
};

type RunResult =
	| { ok: true; stdout: string }
	| { ok: false; code?: string | number; stderr: string };

/** git コマンドを子プロセスで呼んで集計する。リポジトリは読むだけで変更しない */
export class GitCliAdapter implements GitGateway {
	private readonly command: string;
	private readonly env: Record<string, string | undefined>;

	constructor(options: Options = {}) {
		this.command = options.command ?? 'git';
		// 端末の言語設定や pager に左右されないようにする
		this.env = { ...(options.env ?? process.env), LC_ALL: 'C', GIT_PAGER: 'cat' };
	}

	async commitStats({ cwd, since, until }: CommitQuery): Promise<CommitStatsResult> {
		// ディレクトリがない（外付けディスクを外した・worktree を消したなど）のは一時的なことがあるので、
		// 「なし」として保存させず、次に開いたときにもう一度試す
		if (!(await isDirectory(cwd))) {
			return { status: 'unavailable', reason: `作業ディレクトリが見つかりません: ${cwd}` };
		}

		const inside = await this.run(cwd, ['rev-parse', '--is-inside-work-tree']);
		if (!inside.ok) {
			if (inside.code === 'ENOENT')
				return { status: 'unavailable', reason: 'git が見つかりません' };
			if (/not a git repository/i.test(inside.stderr)) return { status: 'no_repository' };
			// Command Line Tools がない・所有者が違うリポジトリなど。原因を直せば集計できるので保存しない
			return {
				status: 'unavailable',
				reason: `git を実行できませんでした: ${inside.stderr.trim()}`,
			};
		}
		// .git の中や bare リポジトリでは false になる
		if (inside.stdout.trim() !== 'true') return { status: 'no_repository' };

		const email = await this.run(cwd, ['config', 'user.email']);
		const author = email.ok ? email.stdout.trim() : '';
		if (!author) {
			return { status: 'unavailable', reason: 'git config user.email が設定されていません' };
		}

		const log = await this.run(cwd, [
			'log',
			// stash と notes のコミットは作業の成果ではないので除く（--exclude は --all より前に書く）
			'--exclude=refs/stash',
			'--exclude=refs/notes/*',
			'--all',
			'--no-merges',
			'--no-color',
			'--fixed-strings',
			'--regexp-ignore-case',
			`--author=<${author}>`,
			// 期間はコミッター日時で判定する（rebase などで付け直されたコミットは、付け直したときに数える）
			`--since=${since.toISOString()}`,
			`--until=${until.toISOString()}`,
			'--name-only',
			`--format=${COMMIT_FORMAT}`,
		]);
		if (!log.ok)
			return { status: 'failed', reason: `git log に失敗しました: ${log.stderr.trim()}` };
		return { status: 'ok', value: parseLog(log.stdout) };
	}

	private run(cwd: string, args: string[]): Promise<RunResult> {
		return new Promise((resolve) => {
			execFile(
				this.command,
				// 利用者の設定で、署名の検証結果や色のエスケープが出力に混ざらないようにする
				['-c', 'log.showSignature=false', '-c', 'color.ui=never', '-C', cwd, ...args],
				{ env: this.env, timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER },
				(error, stdout, stderr) => {
					if (error) resolve({ ok: false, code: (error as NodeJS.ErrnoException).code, stderr });
					else resolve({ ok: true, stdout });
				},
			);
		});
	}
}

/** `git log --name-only` の出力から、コミット数と変更ファイル数（重複なし）を数える */
export function parseLog(stdout: string): { commitCount: number; changedFileCount: number } {
	const commits = new Set<string>();
	const files = new Set<string>();
	for (const line of stdout.split('\n')) {
		if (line.startsWith(COMMIT_MARKER)) {
			const hash = line.slice(COMMIT_MARKER.length).trim();
			if (HASH_PATTERN.test(hash)) commits.add(hash);
		} else if (line.trim()) {
			files.add(line);
		}
	}
	return { commitCount: commits.size, changedFileCount: files.size };
}

async function isDirectory(path: string): Promise<boolean> {
	try {
		return (await stat(path)).isDirectory();
	} catch {
		return false;
	}
}
