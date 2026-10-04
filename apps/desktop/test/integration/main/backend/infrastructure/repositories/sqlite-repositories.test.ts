import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import type { SessionLogEntry } from '../../../../../../src/main/backend/domain/models/session-log-entry.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';

const MIN = 60 * 1000;
const monday = new Date('2026-09-28T00:00:00Z').getTime();
const week = { from: new Date(monday), to: new Date(monday + 7 * 24 * 60 * MIN) };

let dir: string;
let db: Database.Database;
let projects: SqliteProjectRepository;
let sessions: SqliteSessionRepository;

function project(id = 'p1', path = '/repo/app'): Project {
	const result = Project.create({ id, path, lastActivityAt: new Date(monday) });
	if (!result.success) throw new Error(result.error);
	return result.value;
}

/** 指定した時刻（月曜 0 時からの分）にメッセージがあるセッション */
function session(id: string, minutes: number[], projectId = 'p1'): Session {
	const entries: SessionLogEntry[] = minutes.map((m, i) => ({
		timestamp: new Date(monday + m * MIN),
		role: i % 2 === 0 ? 'user' : 'assistant',
		model: i % 2 === 0 ? undefined : 'claude-opus-5-5',
		inputTokens: 10,
		outputTokens: 1,
		cwd: '/repo/app',
	}));
	const result = Session.fromLogEntries({ id, projectId, entries });
	if (!result.success) throw new Error(result.error);
	return result.value;
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	projects = new SqliteProjectRepository(db);
	sessions = new SqliteSessionRepository(db);
	projects.save(project());
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('SqliteProjectRepository', () => {
	it('保存して ID で取得できる。同じ ID で保存すると更新される', () => {
		const later = new Date(monday + MIN);
		projects.save(project().touch(later));

		const found = projects.findById('p1');
		expect(found?.path).toBe('/repo/app');
		expect(found?.lastActivityAt).toEqual(later);
		expect(projects.findById('missing')).toBeNull();
	});
});

describe('SqliteSessionRepository', () => {
	it('セッションと活動区間を保存し、ID で詳細を取得できる', () => {
		const saved = session('s1', [0, 10, 100, 110]);
		sessions.save(saved);

		const found = sessions.findById('s1');
		expect(found?.project.id).toBe('p1');
		expect(found?.session).toEqual(saved);
		expect(found?.session.activities).toHaveLength(2);
		expect(sessions.findById('missing')).toBeNull();
	});

	it('同じ ID で保存すると、セッションを更新し活動区間を置き換える', () => {
		sessions.save(session('s1', [0, 10, 100]));
		sessions.save(session('s1', [0, 5]));

		const found = sessions.findById('s1');
		expect(found?.session.messageCount).toBe(2);
		expect(found?.session.activities).toHaveLength(1);
		expect(db.prepare('SELECT COUNT(*) AS n FROM activities').get()).toEqual({ n: 1 });
	});

	it('活動区間の保存に失敗したら、セッションの更新も巻き戻る', () => {
		sessions.save(session('s1', [0, 10]));
		// 活動区間の INSERT だけを失敗させる
		db.exec(
			"CREATE TRIGGER fail_activity BEFORE INSERT ON activities BEGIN SELECT RAISE(ABORT, 'boom'); END",
		);

		expect(() => sessions.save(session('s1', [0, 10, 20]))).toThrow(/boom/);
		expect(sessions.findById('s1')?.session.messageCount).toBe(2);
		expect(db.prepare('SELECT COUNT(*) AS n FROM activities').get()).toEqual({ n: 1 });
	});

	it('存在しないプロジェクトのセッションは保存できない', () => {
		expect(() => sessions.save(session('s1', [0], 'missing'))).toThrow();
	});

	it('期間に重なる活動区間を持つセッションだけを、開始時刻順に返す', () => {
		projects.save(project('p2', '/repo/other'));
		sessions.save(session('inside', [24 * 60, 24 * 60 + 10], 'p2'));
		// 期間の開始をまたぐ（日曜 23:50〜月曜 0:10）
		sessions.save(session('crosses-start', [-10, 10]));
		// 期間の終了をまたぐ（日曜 23:50〜翌月曜 0:10）
		sessions.save(session('crosses-end', [7 * 24 * 60 - 10, 7 * 24 * 60 + 10]));
		// 前の週で終わっている
		sessions.save(session('before', [-100, -90]));
		// 次の週の開始ちょうど（半開区間なので含まない）
		sessions.save(session('at-end', [7 * 24 * 60]));
		// 期間の開始ちょうどに終わる長さ 0 の区間（含む）
		sessions.save(session('at-start', [0]));
		// 活動区間が前の週と次の週にあり、期間内にはない（放置中）
		sessions.save(session('gap', [-60, 7 * 24 * 60 + 60]));

		const found = sessions.findByPeriod(week);

		expect(found.map((f) => f.session.id)).toEqual([
			'crosses-start',
			'at-start',
			'inside',
			'crosses-end',
		]);
		expect(found.find((f) => f.session.id === 'inside')?.project.path).toBe('/repo/other');
		// 期間外の区間も含めて返す
		expect(found.find((f) => f.session.id === 'crosses-start')?.session.activities).toHaveLength(1);
	});

	it('進行中（最後のメッセージが直近）のセッションも期間内なら返す', () => {
		const now = monday + 3 * 24 * 60 * MIN;
		const active = session('active', [3 * 24 * 60 - 5]);
		sessions.save(active);

		const found = sessions.findByPeriod(week);
		expect(found.map((f) => f.session.id)).toEqual(['active']);
		expect(found[0]?.session.status(new Date(now))).toBe('active');
	});

	it('該当がなければ空を返す', () => {
		expect(sessions.findByPeriod(week)).toEqual([]);
	});
});
