import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GetFilterOptionsUseCase } from '../../../../../../src/main/backend/application/usecases/get-filter-options.usecase';
import { GetTimelineUseCase } from '../../../../../../src/main/backend/application/usecases/get-timeline.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { SessionAnnotation } from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionAnnotationRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session-annotation.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import {
	InvalidIpcRequestError,
	loadFilterOptions,
	loadTimeline,
} from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

const day = (d: number, h = 9) => new Date(Date.UTC(2026, 8, d, h));
const week = { from: day(28, 0), to: day(35, 0) };

let dir: string;
let db: Database.Database;
let sessions: SqliteSessionRepository;
let annotations: SqliteSessionAnnotationRepository;
let projects: SqliteProjectRepository;

function addProject(id: string, path: string, lastActivityAt: Date) {
	const project = Project.create({ id, path, lastActivityAt });
	if (!project.success) throw new Error(project.error);
	projects.save(project.value);
}

function addSession(id: string, projectId: string, summary: string | null, tags: string[]) {
	const session = Session.fromLogEntries({
		id,
		projectId,
		entries: [{ timestamp: day(29), role: 'user', inputTokens: 0, outputTokens: 0 }],
	});
	if (!session.success) throw new Error(session.error);
	sessions.save(session.value);
	const annotation = SessionAnnotation.editManually({ summary, tagNames: tags });
	if (!annotation.success) throw new Error(annotation.error);
	annotations.save(id, annotation.value);
}

const ids = (filter: Parameters<SqliteSessionRepository['findByPeriod']>[1]) =>
	sessions.findByPeriod(week, filter).map((f) => f.session.id);

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	sessions = new SqliteSessionRepository(db);
	annotations = new SqliteSessionAnnotationRepository(db);
	projects = new SqliteProjectRepository(db);
	addProject('p-app', '/repo/app', day(29));
	addProject('p-observer', '/repo/observer', day(30));
	addSession('s1', 'p-app', 'README の誤字を直した', ['docs', 'README']);
	addSession('s2', 'p-app', 'タイムラインに 100% の幅で表示', ['UI']);
	addSession('s3', 'p-observer', '自動で記録したセッション', []);
	addSession('s4', 'p-app', null, ['readme']);
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('SessionRepository.findByPeriod の絞り込み', () => {
	it('条件がなければすべて返す', () => {
		expect(ids({})).toEqual(['s1', 's2', 's3', 's4']);
	});

	it('プロジェクトで絞り込む（複数はいずれか）', () => {
		expect(ids({ projectIds: ['p-observer'] })).toEqual(['s3']);
		expect(ids({ projectIds: ['p-app', 'p-observer'] })).toHaveLength(4);
	});

	it('タグで絞り込む（いずれかのタグ、大文字小文字を区別しない）', () => {
		expect(ids({ tags: ['ReadMe'] })).toEqual(['s1', 's4']);
		expect(ids({ tags: ['ui', 'docs'] })).toEqual(['s1', 's2']);
	});

	it('概要のキーワードで絞り込む。% や _ は文字としてそのまま検索する', () => {
		expect(ids({ query: '誤字' })).toEqual(['s1']);
		expect(ids({ query: '100%' })).toEqual(['s2']);
		expect(ids({ query: '%' })).toEqual(['s2']);
		expect(ids({ query: '_' })).toEqual([]);
		expect(ids({ query: '   ' })).toHaveLength(4);
	});

	it('複数の条件はすべて満たすものを返す', () => {
		expect(ids({ projectIds: ['p-app'], tags: ['readme'], query: 'README' })).toEqual(['s1']);
	});
});

describe('絞り込みの選択肢', () => {
	it('プロジェクトは最終活動日時の新しい順、タグは名前順', () => {
		const options = loadFilterOptions(new GetFilterOptionsUseCase(projects, annotations));

		expect(options.projects.map((p) => [p.id, p.name])).toEqual([
			['p-observer', 'observer'],
			['p-app', 'app'],
		]);
		expect(options.tags).toEqual(['docs', 'README', 'UI']);
	});
});

describe('loadTimeline の絞り込み条件', () => {
	const useCase = () => new GetTimelineUseCase(sessions, annotations);
	const request = (filter: unknown) => ({
		from: week.from.toISOString(),
		to: week.to.toISOString(),
		filter,
	});

	it('条件を UseCase に渡す', () => {
		const dto = loadTimeline(useCase(), request({ tags: ['UI'] }), day(30));
		expect(dto.sessions.map((s) => s.id)).toEqual(['s2']);
	});

	it.each([
		['オブジェクトでない', 'x'],
		['projectIds が配列でない', { projectIds: 'p-app' }],
		['tags に文字列以外', { tags: [1] }],
		['キーワードが文字列でない', { query: 1 }],
		['キーワードが長すぎる', { query: 'x'.repeat(201) }],
		['候補が多すぎる', { tags: Array.from({ length: 101 }, (_, i) => String(i)) }],
	])('不正な条件（%s）はエラーにする', (_label, filter) => {
		expect(() => loadTimeline(useCase(), request(filter), day(30))).toThrow(InvalidIpcRequestError);
	});
});
