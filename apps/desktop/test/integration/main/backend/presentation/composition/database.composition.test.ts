import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { openAppDatabase } from '../../../../../../src/main/backend/presentation/composition/database.composition';

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe('openAppDatabase', () => {
	it('userData 配下に DB ファイルを作り、最新のスキーマまでマイグレーションする', () => {
		const db = openAppDatabase(dir);

		expect(existsSync(join(dir, 'cc-work-history.db'))).toBe(true);
		expect(db.pragma('user_version', { simple: true })).toBe(
			SqliteMigrator.fromFiles(migrationFiles).latestVersion,
		);
		db.close();
	});

	it('マイグレーションに失敗した場合は DB を閉じて例外を投げる', () => {
		const db = openAppDatabase(dir);
		db.pragma('user_version = 9999');
		db.close();

		expect(() => openAppDatabase(dir)).toThrow(/新しい/);
	});
});
