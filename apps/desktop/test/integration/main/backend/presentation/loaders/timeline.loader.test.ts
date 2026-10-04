import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GetSessionDetailUseCase } from '../../../../../../src/main/backend/application/usecases/get-session-detail.usecase';
import { GetTimelineUseCase } from '../../../../../../src/main/backend/application/usecases/get-timeline.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import type { SessionLogEntry } from '../../../../../../src/main/backend/domain/models/session-log-entry.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionAnnotationRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session-annotation.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import {
	InvalidIpcRequestError,
	loadSessionDetail,
	loadTimeline,
} from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

const MIN = 60 * 1000;
const monday = Date.parse('2026-09-28T00:00:00.000Z');
const iso = (offsetMin: number) => new Date(monday + offsetMin * MIN).toISOString();
const week = { from: iso(0), to: iso(7 * 24 * 60) };

let dir: string;
let db: Database.Database;
let getTimeline: GetTimelineUseCase;
let getSessionDetail: GetSessionDetailUseCase;

function save(id: string, minutes: number[], models: string[] = []) {
	const entries: SessionLogEntry[] = minutes.map((m, i) => ({
		timestamp: new Date(monday + m * MIN),
		role: i % 2 === 0 ? 'user' : 'assistant',
		model: models[i],
		inputTokens: 100,
		outputTokens: 10,
		cwd: '/Users/me/repo/app',
	}));
	const session = Session.fromLogEntries({ id, projectId: 'p1', entries });
	if (!session.success) throw new Error(session.error);
	new SqliteSessionRepository(db).save(session.value);
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	const project = Project.create({
		id: 'p1',
		path: '/Users/me/repo/app',
		lastActivityAt: new Date(monday),
	});
	if (!project.success) throw new Error(project.error);
	new SqliteProjectRepository(db).save(project.value);
	const sessions = new SqliteSessionRepository(db);
	const annotations = new SqliteSessionAnnotationRepository(db);
	getTimeline = new GetTimelineUseCase(sessions, annotations);
	getSessionDetail = new GetSessionDetailUseCase(sessions, annotations);
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('loadTimeline', () => {
	it('期間に重なるセッションを、日時を ISO 文字列にしたプレーンな DTO で返す', () => {
		// 前の週の日曜 23:00 から始まり、月曜 0:10 まで（間に 60 分の放置）
		save('s1', [-60, -50, 0, 10]);
		const now = new Date(monday + 10 * MIN + 5 * MIN);

		const dto = loadTimeline(getTimeline, week, now);

		expect(dto).toEqual({
			from: week.from,
			to: week.to,
			sessions: [
				{
					id: 's1',
					project: { id: 'p1', name: 'app', path: '/Users/me/repo/app' },
					startedAt: iso(-60),
					endedAt: iso(10),
					status: 'active',
					totalTokens: 440,
					messageCount: 4,
					summary: null,
					tags: [],
					// 期間に重なる区間だけ
					activities: [{ startedAt: iso(0), endedAt: iso(10), messageCount: 2 }],
				},
			],
		});
		// IPC で送れるプレーンな値だけで構成されている
		expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
	});

	it.each([
		['期間がない', undefined],
		['日時でない値', { from: 'yesterday', to: week.to }],
		['数値', { from: 0, to: week.to }],
		['from が to 以降', { from: week.to, to: week.from }],
		['31 日を超える期間', { from: iso(0), to: iso(32 * 24 * 60) }],
	])('不正な引数（%s）はエラーにする', (_label, request) => {
		expect(() => loadTimeline(getTimeline, request, new Date())).toThrow(InvalidIpcRequestError);
	});
});

describe('loadSessionDetail', () => {
	it('セッションの詳細を DTO で返す', () => {
		save('s1', [0, 1, 100, 101], [
			undefined,
			'claude-opus-5-5',
			undefined,
			'claude-sonnet-5-5',
		] as string[]);

		const dto = loadSessionDetail(getSessionDetail, { id: 's1' }, new Date(monday + 300 * MIN));

		expect(dto).toMatchObject({
			id: 's1',
			project: { id: 'p1', name: 'app', path: '/Users/me/repo/app' },
			cwd: '/Users/me/repo/app',
			startedAt: iso(0),
			endedAt: iso(101),
			activeDurationMs: 2 * MIN,
			status: 'completed',
			inputTokens: 400,
			outputTokens: 40,
			totalTokens: 440,
			messageCount: 4,
			models: ['claude-opus-5-5', 'claude-sonnet-5-5'],
			activities: [
				{ startedAt: iso(0), endedAt: iso(1), messageCount: 2 },
				{ startedAt: iso(100), endedAt: iso(101), messageCount: 2 },
			],
		});
		expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
	});

	it('見つからなければ null を返す', () => {
		expect(loadSessionDetail(getSessionDetail, { id: 'missing' }, new Date())).toBeNull();
	});

	it.each([
		['ID がない', {}],
		['空の ID', { id: '  ' }],
		['文字列でない ID', { id: 1 }],
		['長すぎる ID', { id: 'x'.repeat(201) }],
		['オブジェクトでない', 's1'],
	])('不正な引数（%s）はエラーにする', (_label, request) => {
		expect(() => loadSessionDetail(getSessionDetail, request, new Date())).toThrow(
			InvalidIpcRequestError,
		);
	});
});
