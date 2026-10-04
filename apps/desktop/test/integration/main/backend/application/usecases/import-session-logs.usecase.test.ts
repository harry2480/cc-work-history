import {
	appendFileSync,
	chmodSync,
	cpSync,
	mkdtempSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ImportSessionLogsUseCase } from '../../../../../../src/main/backend/application/usecases/import-session-logs.usecase';
import { ClaudeCodeSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/claude-code-session-log.adapter';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionLogFileRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session-log-file.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';

const fixtures = resolve(__dirname, '../../../../../fixtures/claude-projects');
const sessionFile = join('-Users-me-repo-app', '11111111-1111-4111-8111-111111111111.jsonl');

let dir: string;
let logDir: string;
let db: Database.Database;
let sessions: SqliteSessionRepository;

function useCase() {
	return new ImportSessionLogsUseCase(
		new ClaudeCodeSessionLogAdapter(logDir),
		new SqliteProjectRepository(db),
		sessions,
		new SqliteSessionLogFileRepository(db),
	);
}

const count = (table: string) =>
	(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	logDir = join(dir, 'projects');
	cpSync(fixtures, logDir, { recursive: true });
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	sessions = new SqliteSessionRepository(db);
});

afterEach(() => {
	db.close();
	chmodSync(dir, 0o755);
	rmSync(dir, { recursive: true, force: true });
});

describe('ImportSessionLogsUseCase（実ファイル + SQLite）', () => {
	it('初回は全件を取り込み、2 回目は変わっていないファイルを読まない', async () => {
		expect(await useCase().execute()).toEqual({
			scanned: 2,
			imported: 2,
			unchanged: 0,
			empty: 0,
			failures: [],
		});
		expect(count('sessions')).toBe(2);
		expect(count('projects')).toBe(2);

		expect(await useCase().execute()).toMatchObject({ imported: 0, unchanged: 2 });
	});

	it('追記されたファイルだけを再取り込みする', async () => {
		await useCase().execute();
		appendFileSync(
			join(logDir, sessionFile),
			`${JSON.stringify({ type: 'user', timestamp: '2026-10-01T09:45:00.000Z', message: { content: '（追記）' } })}\n`,
		);
		utimesSync(join(logDir, sessionFile), new Date(), new Date(Date.now() + 1000));

		expect(await useCase().execute()).toMatchObject({ imported: 1, unchanged: 1 });
		expect(sessions.findById('11111111-1111-4111-8111-111111111111')?.session.messageCount).toBe(6);
	});

	it('壊れたファイル・読めないファイルがあっても他の取り込みを続け、既存データを壊さない', async () => {
		await useCase().execute();
		const before = sessions.findById('11111111-1111-4111-8111-111111111111');

		// 全行が壊れたファイル（メッセージ 0 件）
		writeFileSync(join(logDir, '-Users-me-repo-app', 'broken.jsonl'), '{"type":\n???\n');
		// 読めないファイル
		const unreadable = join(logDir, '-Users-me-repo-other', 'unreadable.jsonl');
		writeFileSync(unreadable, '{}\n');
		chmodSync(unreadable, 0o000);
		// 新しいセッション
		writeFileSync(
			join(logDir, '-Users-me-repo-other', 'new.jsonl'),
			`${JSON.stringify({ type: 'user', timestamp: '2026-10-03T10:00:00.000Z', cwd: '/Users/me/repo/other' })}\n`,
		);

		const result = await useCase().execute();

		expect(result).toMatchObject({ scanned: 5, imported: 1, unchanged: 2, empty: 1 });
		expect(result.failures.map((f) => f.path)).toEqual([unreadable]);
		expect(sessions.findById('new')).not.toBeNull();
		expect(sessions.findById('11111111-1111-4111-8111-111111111111')).toEqual(before);
	});
});
