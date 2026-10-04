import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ListSessionsUseCase } from '../../../../../../src/main/backend/application/usecases/list-sessions.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { SessionAnnotation } from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import type { SessionSortKey } from '../../../../../../src/main/backend/domain/repositories/session.repository';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionAnnotationRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session-annotation.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { loadSessionList } from '../../../../../../src/main/backend/presentation/loaders/session-list.loader';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

const MIN = 60_000;
const t = (day: number, min = 0) => new Date(Date.UTC(2026, 8, day, 9, min));

let dir: string;
let db: Database.Database;
let sessions: SqliteSessionRepository;
let annotations: SqliteSessionAnnotationRepository;

function addProject(id: string, path: string) {
	const project = Project.create({ id, path, lastActivityAt: t(1) });
	if (!project.success) throw new Error(project.error);
	new SqliteProjectRepository(db).save(project.value);
}

/** day 日の 9:00 から minutes 分の活動、メッセージごとに tokens トークン */
function addSession(id: string, projectId: string, day: number, minutes: number, tokens: number) {
	const session = Session.fromLogEntries({
		id,
		projectId,
		entries: [
			{ timestamp: t(day), role: 'user', inputTokens: tokens, outputTokens: 0 },
			{ timestamp: t(day, minutes), role: 'assistant', inputTokens: 0, outputTokens: 0 },
		],
	});
	if (!session.success) throw new Error(session.error);
	sessions.save(session.value);
}

const ids = (key: SessionSortKey, direction: 'asc' | 'desc', offset = 0, limit = 10) =>
	sessions.search({ sort: { key, direction }, offset, limit }).items.map((i) => i.session.id);

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	sessions = new SqliteSessionRepository(db);
	annotations = new SqliteSessionAnnotationRepository(db);
	addProject('p-b', '/repo/beta');
	addProject('p-a', '/repo/Alpha');
	addSession('s1', 'p-b', 1, 10, 500);
	addSession('s2', 'p-a', 3, 30, 100);
	addSession('s3', 'p-b', 2, 20, 300);
	const annotation = SessionAnnotation.editManually({
		summary: '誤字を直した',
		tagNames: ['docs'],
	});
	if (!annotation.success) throw new Error(annotation.error);
	annotations.save('s3', annotation.value);
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('SessionRepository.search', () => {
	it('各列で昇順・降順に並べる', () => {
		expect(ids('startedAt', 'desc')).toEqual(['s2', 's3', 's1']);
		expect(ids('startedAt', 'asc')).toEqual(['s1', 's3', 's2']);
		// プロジェクトはパスで、大文字小文字を区別しない（/repo/Alpha < /repo/beta）
		expect(ids('project', 'asc')).toEqual(['s2', 's3', 's1']);
		expect(ids('activeDuration', 'desc')).toEqual(['s2', 's3', 's1']);
		expect(ids('totalTokens', 'desc')).toEqual(['s1', 's3', 's2']);
	});

	it('ページ分けし、total は絞り込み後の件数', () => {
		const result = sessions.search({
			sort: { key: 'startedAt', direction: 'desc' },
			offset: 1,
			limit: 1,
		});
		expect(result.items.map((i) => i.session.id)).toEqual(['s3']);
		expect(result.total).toBe(3);
	});

	it('期間を問わずに絞り込める（タイムラインと同じ条件）', () => {
		const search = (filter: object) =>
			sessions.search({
				filter,
				sort: { key: 'startedAt', direction: 'asc' },
				offset: 0,
				limit: 10,
			});

		expect(search({ projectIds: ['p-b'] }).items.map((i) => i.session.id)).toEqual(['s1', 's3']);
		expect(search({ tags: ['DOCS'] }).total).toBe(1);
		expect(search({ query: '誤字' }).items.map((i) => i.session.id)).toEqual(['s3']);
	});
});

describe('loadSessionList', () => {
	const useCase = () => new ListSessionsUseCase(sessions, annotations);
	const request = (overrides: object = {}) => ({
		sort: { key: 'startedAt', direction: 'desc' },
		page: 1,
		pageSize: 2,
		...overrides,
	});

	it('1 始まりのページで返し、概要・タグ・活動時間を含める', () => {
		const dto = loadSessionList(useCase(), request({ page: 2 }), t(10));

		expect(dto).toMatchObject({ total: 3, page: 2, pageSize: 2 });
		expect(dto.items).toEqual([
			expect.objectContaining({
				id: 's1',
				activeDurationMs: 10 * MIN,
				status: 'completed',
				tags: [],
			}),
		]);
		const first = loadSessionList(useCase(), request(), t(10)).items[1];
		expect(first).toMatchObject({
			id: 's3',
			summary: '誤字を直した',
			tags: ['docs'],
			startedAt: t(2).toISOString(),
		});
	});

	it.each([
		['並び替えの列が不正', { sort: { key: 'summary', direction: 'asc' } }],
		['並び替えの向きが不正', { sort: { key: 'startedAt', direction: 'up' } }],
		['ページが 0', { page: 0 }],
		['ページが整数でない', { page: 1.5 }],
		['1 ページの件数が多すぎる', { pageSize: 201 }],
		['絞り込み条件が不正', { filter: { tags: 'docs' } }],
	])('不正なリクエスト（%s）はエラーにする', (_label, overrides) => {
		expect(() => loadSessionList(useCase(), request(overrides), t(10))).toThrow(
			InvalidIpcRequestError,
		);
	});
});
