import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GetDashboardUseCase } from '../../../../../../src/main/backend/application/usecases/get-dashboard.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteActivityStatsRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-activity-stats.repository';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { loadDashboard } from '../../../../../../src/main/backend/presentation/loaders/dashboard.loader';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

const MIN = 60_000;
// ローカル時刻の 2026-09-28（月）0:00 からの週
const monday = new Date(2026, 8, 28).getTime();
const at = (dayOffset: number, hour: number, min = 0) =>
	new Date(new Date(2026, 8, 28 + dayOffset, hour, min).getTime());
const week = { from: new Date(monday), to: new Date(2026, 9, 5) };

let dir: string;
let db: Database.Database;
let stats: SqliteActivityStatsRepository;

function addProject(id: string, path: string) {
	const project = Project.create({ id, path, lastActivityAt: new Date(monday) });
	if (!project.success) throw new Error(project.error);
	new SqliteProjectRepository(db).save(project.value);
}

/** 指定した時刻にメッセージがあるセッション（各メッセージ 100 + 10 トークン） */
function addSession(id: string, projectId: string, times: Date[]) {
	const session = Session.fromLogEntries({
		id,
		projectId,
		entries: times.map((timestamp) => ({
			timestamp,
			role: 'user',
			inputTokens: 100,
			outputTokens: 10,
		})),
	});
	if (!session.success) throw new Error(session.error);
	new SqliteSessionRepository(db).save(session.value);
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	stats = new SqliteActivityStatsRepository(db);
	addProject('p-app', '/repo/app');
	addProject('p-web', '/repo/web');
	// 月曜 9:00〜10:00（60 分）と 14:00〜14:30（30 分）の 2 区間
	addSession('s1', 'p-app', [at(0, 9), at(0, 9, 30), at(0, 10), at(0, 14), at(0, 14, 30)]);
	// 火曜 22:00〜水曜 1:00（日付をまたぐ 180 分）
	addSession('s2', 'p-web', [
		at(1, 22),
		at(1, 22, 25),
		at(1, 22, 50),
		at(1, 23, 15),
		at(1, 23, 40),
		at(2, 0, 5),
		at(2, 0, 30),
		at(2, 1),
	]);
	// 前の週の日曜 23:30〜月曜 0:30（週の開始をまたぐ。週内は 30 分）
	addSession('s3', 'p-app', [at(-1, 23, 30), at(-1, 23, 55), at(0, 0, 20), at(0, 0, 30)]);
	// 前の週だけ
	addSession('s4', 'p-web', [at(-3, 10), at(-3, 11)]);
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('SqliteActivityStatsRepository', () => {
	it('期間の合計: 活動時間は期間内に収まる部分だけ、トークン・メッセージは重なるセッションの合計', () => {
		expect(stats.summarize(week)).toEqual({
			activeMs: (90 + 180 + 30) * MIN,
			sessionCount: 3,
			totalTokens: (5 + 8 + 4) * 110,
			messageCount: 5 + 8 + 4,
		});
	});

	it('区切りごとの集計（日をまたぐ区間は日ごとに切り分ける）', () => {
		const days = [0, 1, 2].map((d) => ({ from: at(d, 0), to: at(d + 1, 0) }));

		expect(stats.summarizeByBuckets(days)).toEqual([
			{ activeMs: (90 + 30) * MIN, sessionCount: 2, totalTokens: 0, messageCount: 0 },
			{ activeMs: 120 * MIN, sessionCount: 1, totalTokens: 0, messageCount: 0 },
			{ activeMs: 60 * MIN, sessionCount: 1, totalTokens: 0, messageCount: 0 },
		]);
	});

	it('プロジェクト別の集計を活動時間の長い順に返す', () => {
		expect(stats.summarizeByProject(week)).toEqual([
			{
				projectId: 'p-web',
				projectPath: '/repo/web',
				activeMs: 180 * MIN,
				sessionCount: 1,
				totalTokens: 880,
			},
			{
				projectId: 'p-app',
				projectPath: '/repo/app',
				activeMs: 120 * MIN,
				sessionCount: 2,
				totalTokens: 990,
			},
		]);
	});

	it('該当がなければ 0 と空', () => {
		const empty = { from: at(30, 0), to: at(31, 0) };
		expect(stats.summarize(empty)).toEqual({
			activeMs: 0,
			sessionCount: 0,
			totalTokens: 0,
			messageCount: 0,
		});
		expect(stats.summarizeByProject(empty)).toEqual([]);
	});
});

describe('loadDashboard', () => {
	const useCase = () => new GetDashboardUseCase(stats);

	it('週を日ごとに区切り、プロジェクト名を付けて返す', () => {
		const dto = loadDashboard(useCase(), {
			from: week.from.toISOString(),
			to: week.to.toISOString(),
		});

		expect(dto.daily).toHaveLength(7);
		expect(dto.daily[0]).toEqual({
			date: at(0, 0).toISOString(),
			activeMs: 120 * MIN,
			sessionCount: 2,
		});
		expect(dto.daily.slice(3).every((d) => d.activeMs === 0)).toBe(true);
		expect(dto.projects.map((p) => p.project.name)).toEqual(['web', 'app']);
		expect(dto.summary.sessionCount).toBe(3);
	});

	it('月を指定すると、その月の日数分の日別を返す', () => {
		const dto = loadDashboard(useCase(), {
			from: new Date(2026, 9, 1).toISOString(),
			to: new Date(2026, 10, 1).toISOString(),
		});
		expect(dto.daily).toHaveLength(31);
	});

	it('不正な期間はエラーにする', () => {
		expect(() => loadDashboard(useCase(), { from: 'x', to: 'y' })).toThrow(InvalidIpcRequestError);
	});
});
