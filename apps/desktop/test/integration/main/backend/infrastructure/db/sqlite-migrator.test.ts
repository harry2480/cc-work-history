import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import {
	type Migration,
	SqliteMigrator,
} from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';

const migrations: Migration[] = [
	{ version: 1, name: '0001_create_a.sql', sql: 'CREATE TABLE a (id INTEGER PRIMARY KEY);' },
	{ version: 2, name: '0002_create_b.sql', sql: 'CREATE TABLE b (id INTEGER PRIMARY KEY);' },
];

let dir: string;
let db: Database.Database;

const userVersion = () => db.pragma('user_version', { simple: true });
const tables = () =>
	db
		.prepare<[], { name: string }>(
			"SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
		)
		.all()
		.map((row) => row.name);

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'nested', 'test.db'));
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('SqliteMigrator', () => {
	it('空の DB に全マイグレーションを順に適用する', () => {
		const applied = new SqliteMigrator(migrations).migrate(db);

		expect(applied).toEqual([1, 2]);
		expect(userVersion()).toBe(2);
		expect(tables()).toEqual(['a', 'b']);
	});

	it('2 回実行しても再適用しない', () => {
		const migrator = new SqliteMigrator(migrations);
		migrator.migrate(db);

		// 再適用すると CREATE TABLE が失敗するので、例外が出ないこと自体も確認になる
		expect(migrator.migrate(db)).toEqual([]);
		expect(userVersion()).toBe(2);
	});

	it('適用済みのバージョンより後のものだけを適用する', () => {
		new SqliteMigrator(migrations.slice(0, 1)).migrate(db);

		expect(new SqliteMigrator(migrations).migrate(db)).toEqual([2]);
		expect(tables()).toEqual(['a', 'b']);
	});

	it('失敗したマイグレーションは丸ごと巻き戻り、バージョンも進まない', () => {
		const broken: Migration[] = [
			...migrations.slice(0, 1),
			{ version: 2, name: '0002_broken.sql', sql: 'CREATE TABLE c (id INTEGER); INVALID SQL;' },
		];

		expect(() => new SqliteMigrator(broken).migrate(db)).toThrow();
		expect(userVersion()).toBe(1);
		expect(tables()).toEqual(['a']);
	});

	it('DB のバージョンがアプリの想定より新しい場合はエラーにする', () => {
		db.pragma('user_version = 3');

		expect(() => new SqliteMigrator(migrations).migrate(db)).toThrow(/新しい/);
	});

	it('連番が 1 から連続していない場合はエラーにする', () => {
		expect(() => new SqliteMigrator([migrations[1] as Migration])).toThrow(/連続/);
	});

	it('ファイル名の形式が不正な場合はエラーにする', () => {
		expect(() => SqliteMigrator.fromFiles({ './migrations/init.sql': 'SELECT 1;' })).toThrow(
			/ファイル名/,
		);
	});

	it('リポジトリの migrations/ をすべて適用できる', () => {
		const migrator = SqliteMigrator.fromFiles(migrationFiles);

		expect(migrator.latestVersion).toBeGreaterThanOrEqual(1);
		migrator.migrate(db);
		expect(userVersion()).toBe(migrator.latestVersion);
	});
});

describe('0007_create_session_todos', () => {
	it('既存のセッションにチェックリストを作るため、取り込み済みのログの記録を消して読み直させる', () => {
		const before = Object.fromEntries(
			Object.entries(migrationFiles).filter(([path]) => !/\/000[7-9]_|\/00[1-9]\d_/.test(path)),
		);
		SqliteMigrator.fromFiles(before).migrate(db);
		db.prepare(
			"INSERT INTO session_log_files (path, project_id, session_id, modified_at, size_bytes) VALUES ('/x.jsonl', 'p', 's', 0, 0)",
		).run();

		SqliteMigrator.fromFiles(migrationFiles).migrate(db);

		expect(tables()).toContain('session_todos');
		expect(db.prepare('SELECT COUNT(*) AS n FROM session_log_files').get()).toEqual({ n: 0 });
	});
});

describe('openSqliteDatabase', () => {
	it('親ディレクトリを作成し、WAL と外部キー制約を有効にする', () => {
		expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
		expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
	});
});
