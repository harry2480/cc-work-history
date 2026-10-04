import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitCliAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/git-cli.adapter';

let dir: string;
let repo: string;
/** 利用者の git 設定に左右されないよう、設定ファイルを読ませない */
let env: Record<string, string | undefined>;

const at = (hour: number) => new Date(Date.UTC(2026, 9, 1, hour));

function git(args: string[], extraEnv: Record<string, string> = {}) {
	execFileSync('git', ['-C', repo, ...args], { env: { ...env, ...extraEnv }, stdio: 'pipe' });
}

function commit(files: string[], date: Date, email = 'me@example.com') {
	for (const file of files) {
		mkdirSync(join(repo, file, '..'), { recursive: true });
		writeFileSync(join(repo, file), `${file} ${date.toISOString()} ${Math.random()}`);
	}
	git(['add', '.']);
	git(['commit', '-q', '-m', `change ${files.join(',')}`], {
		GIT_AUTHOR_NAME: 'Someone',
		GIT_AUTHOR_EMAIL: email,
		GIT_AUTHOR_DATE: date.toISOString(),
		GIT_COMMITTER_NAME: 'Someone',
		GIT_COMMITTER_EMAIL: email,
		GIT_COMMITTER_DATE: date.toISOString(),
	});
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	repo = join(dir, 'repo');
	mkdirSync(repo);
	env = {
		PATH: process.env.PATH,
		HOME: dir,
		GIT_CONFIG_GLOBAL: join(dir, 'gitconfig'),
		GIT_CONFIG_NOSYSTEM: '1',
	};
	writeFileSync(join(dir, 'gitconfig'), '');
	git(['init', '-q', '-b', 'main']);
	git(['config', 'user.email', 'me@example.com']);
	git(['config', 'user.name', 'Me']);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe('GitCliAdapter', () => {
	it('期間中の自分のコミット数と、変更したファイルの数（重複なし）を数える', async () => {
		commit(['before.txt'], at(8));
		commit(['src/a.ts', 'src/b.ts'], at(9));
		commit(['src/a.ts', 'README.md'], at(10));
		commit(['other.txt'], at(10), 'someone-else@example.com');
		commit(['after.txt'], at(12));
		// 別のブランチのコミットも数える
		git(['checkout', '-q', '-b', 'feature']);
		commit(['feature.ts'], at(10));
		git(['checkout', '-q', 'main']);

		const result = await new GitCliAdapter({ env }).commitStats({
			cwd: repo,
			since: at(9),
			until: at(11),
		});

		expect(result).toEqual({ status: 'ok', value: { commitCount: 3, changedFileCount: 4 } });
	});

	it('リポジトリの中のサブディレクトリからでも数える', async () => {
		commit(['packages/web/index.ts'], at(10));

		const result = await new GitCliAdapter({ env }).commitStats({
			cwd: join(repo, 'packages'),
			since: at(9),
			until: at(11),
		});

		expect(result).toEqual({ status: 'ok', value: { commitCount: 1, changedFileCount: 1 } });
	});

	it('メールアドレスが部分一致するだけの別の人のコミットは数えない', async () => {
		commit(['a.txt'], at(10), 'not-me@example.com');

		const result = await new GitCliAdapter({ env }).commitStats({
			cwd: repo,
			since: at(9),
			until: at(11),
		});

		expect(result).toEqual({ status: 'ok', value: { commitCount: 0, changedFileCount: 0 } });
	});

	it('git リポジトリでないディレクトリや .git の中は no_repository', async () => {
		const plain = join(dir, 'plain');
		mkdirSync(plain);
		const adapter = new GitCliAdapter({ env: { ...env, GIT_CEILING_DIRECTORIES: dir } });

		expect(await adapter.commitStats({ cwd: plain, since: at(9), until: at(11) })).toEqual({
			status: 'no_repository',
		});
		expect(
			await new GitCliAdapter({ env }).commitStats({
				cwd: join(repo, '.git'),
				since: at(9),
				until: at(11),
			}),
		).toEqual({ status: 'no_repository' });
	});

	it('存在しないディレクトリは、一時的なことがあるので unavailable（保存させない）', async () => {
		const result = await new GitCliAdapter({ env }).commitStats({
			cwd: join(dir, 'missing'),
			since: at(9),
			until: at(11),
		});

		expect(result).toMatchObject({ status: 'unavailable' });
	});

	it('stash のコミットは数えない', async () => {
		commit(['a.txt'], at(10));
		writeFileSync(join(repo, 'a.txt'), 'changed');
		writeFileSync(join(repo, 'untracked.txt'), 'new');
		git(['stash', '-u', '-q'], {
			GIT_AUTHOR_DATE: at(10).toISOString(),
			GIT_COMMITTER_DATE: at(10).toISOString(),
		});

		const result = await new GitCliAdapter({ env }).commitStats({
			cwd: repo,
			since: at(9),
			until: at(11),
		});

		expect(result).toEqual({ status: 'ok', value: { commitCount: 1, changedFileCount: 1 } });
	});

	it('署名の表示や色の設定が有効でも、出力をファイルとして数えない', async () => {
		commit(['a.txt'], at(10));
		git(['config', 'log.showSignature', 'true']);
		git(['config', 'color.ui', 'always']);

		const result = await new GitCliAdapter({ env }).commitStats({
			cwd: repo,
			since: at(9),
			until: at(11),
		});

		expect(result).toEqual({ status: 'ok', value: { commitCount: 1, changedFileCount: 1 } });
	});

	it('メールアドレスの大文字小文字の違いは同じ人として数える', async () => {
		commit(['a.txt'], at(10), 'Me@Example.com');

		const result = await new GitCliAdapter({ env }).commitStats({
			cwd: repo,
			since: at(9),
			until: at(11),
		});

		expect(result).toEqual({ status: 'ok', value: { commitCount: 1, changedFileCount: 1 } });
	});

	it('user.email が設定されていなければ unavailable', async () => {
		git(['config', '--unset', 'user.email']);

		const result = await new GitCliAdapter({ env }).commitStats({
			cwd: repo,
			since: at(9),
			until: at(11),
		});

		expect(result).toMatchObject({
			status: 'unavailable',
			reason: expect.stringContaining('user.email'),
		});
	});

	it('git が見つからなければ unavailable', async () => {
		const result = await new GitCliAdapter({
			env,
			command: join(dir, 'no-such-git'),
		}).commitStats({ cwd: repo, since: at(9), until: at(11) });

		expect(result).toMatchObject({ status: 'unavailable' });
	});
});
