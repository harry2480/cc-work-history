import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';

/** SQLite ファイルを開く（なければ作成する）。`:memory:` も指定できる */
export function openSqliteDatabase(filePath: string): Database.Database {
	if (filePath !== ':memory:') {
		mkdirSync(dirname(filePath), { recursive: true });
	}
	const db = new Database(filePath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	return db;
}
