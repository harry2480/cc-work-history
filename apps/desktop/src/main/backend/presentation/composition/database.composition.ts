import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { migrationFiles } from '../../infrastructure/db/migrations';
import { openSqliteDatabase } from '../../infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../infrastructure/db/sqlite-migrator';

const DATABASE_FILE_NAME = 'cc-work-history.db';

/** アプリの DB を開き、未適用のマイグレーションを適用する */
export function openAppDatabase(userDataDir: string): Database.Database {
	const db = openSqliteDatabase(join(userDataDir, DATABASE_FILE_NAME));
	try {
		SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	} catch (error) {
		db.close();
		throw error;
	}
	return db;
}
