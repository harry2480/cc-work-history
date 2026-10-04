import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GetFilterOptionsUseCase } from '../../../../../../src/main/backend/application/usecases/get-filter-options.usecase';
import { GetProjectVisibilityUseCase } from '../../../../../../src/main/backend/application/usecases/get-project-visibility.usecase';
import {
	ProjectNotFoundError,
	UpdateProjectVisibilityUseCase,
} from '../../../../../../src/main/backend/application/usecases/update-project-visibility.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { SessionAnnotation } from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteActivityStatsRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-activity-stats.repository';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionAnnotationRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session-annotation.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { updateProjectVisibility } from '../../../../../../src/main/backend/presentation/actions/project-visibility.action';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

const at = (hour: number) => new Date(Date.UTC(2026, 9, 1, hour));
const period = { from: at(0), to: at(24) };

let dir: string;
let db: Database.Database;
let projects: SqliteProjectRepository;
let sessions: SqliteSessionRepository;

function addProject(id: string, path: string, lastActivityAt = at(12)) {
	const project = Project.create({ id, path, lastActivityAt });
	if (!project.success) throw new Error(project.error);
	projects.save(project.value);
}

function addSession(id: string, projectId: string) {
	const session = Session.fromLogEntries({
		id,
		projectId,
		entries: [at(9), at(10)].map((timestamp) => ({
			timestamp,
			role: 'user' as const,
			inputTokens: 100,
			outputTokens: 10,
		})),
	});
	if (!session.success) throw new Error(session.error);
	sessions.save(session.value);
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	projects = new SqliteProjectRepository(db);
	sessions = new SqliteSessionRepository(db);
	addProject('p-app', '/repo/app', at(12));
	addProject('p-mem', '/repo/claude-mem-observer-sessions', at(13));
	addSession('s-app', 'p-app');
	addSession('s-mem', 'p-mem');
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('プロジェクトの非表示', () => {
	it('非表示にしたプロジェクトを記録し、表示に戻せる。見つからなければ false', () => {
		expect(projects.findHiddenIds()).toEqual([]);
		expect(projects.setHidden('p-mem', true)).toBe(true);
		expect(projects.findHiddenIds()).toEqual(['p-mem']);
		expect(projects.setHidden('p-mem', false)).toBe(true);
		expect(projects.findHiddenIds()).toEqual([]);
		expect(projects.setHidden('missing', true)).toBe(false);
	});

	it('取り込みでプロジェクトを保存し直しても、非表示のまま', () => {
		projects.setHidden('p-mem', true);
		addProject('p-mem', '/repo/claude-mem-observer-sessions', at(20));
		expect(projects.findHiddenIds()).toEqual(['p-mem']);
	});

	it('非表示のプロジェクトのセッションは、タイムライン・一覧・集計・絞り込みの選択肢に出さない', () => {
		const annotations = new SqliteSessionAnnotationRepository(db);
		annotations.save(
			's-app',
			SessionAnnotation.empty().withGenerated({ summary: 'a', tagNames: ['共通', 'app'] }),
		);
		annotations.save(
			's-mem',
			SessionAnnotation.empty().withGenerated({ summary: 'm', tagNames: ['共通', 'memo'] }),
		);
		projects.setHidden('p-mem', true);

		expect(sessions.findByPeriod(period).map((s) => s.session.id)).toEqual(['s-app']);
		const searched = sessions.search({
			sort: { key: 'startedAt', direction: 'desc' },
			offset: 0,
			limit: 10,
		});
		expect(searched.items.map((s) => s.session.id)).toEqual(['s-app']);
		expect(searched.total).toBe(1);

		const stats = new SqliteActivityStatsRepository(db);
		expect(stats.summarize(period).sessionCount).toBe(1);
		expect(stats.summarizeByBuckets([period])[0]?.sessionCount).toBe(1);
		expect(stats.summarizeByProject(period).map((p) => p.projectId)).toEqual(['p-app']);

		const filterOptions = new GetFilterOptionsUseCase(projects, annotations).execute();
		expect(filterOptions.projects.map((p) => p.id)).toEqual(['p-app']);
		// 非表示のプロジェクトでしか使っていないタグも選択肢に出さない
		expect(filterOptions.tags).toEqual(['app', '共通']);

		// 非表示のプロジェクトを指定して絞り込んでも出さない
		expect(sessions.findByPeriod(period, { projectIds: ['p-mem'] })).toEqual([]);

		// 詳細はセッション ID を指定すれば読める
		expect(sessions.findById('s-mem')?.session.id).toBe('s-mem');
	});

	it('設定画面用の一覧には、非表示のプロジェクトも状態付きで含める', () => {
		new UpdateProjectVisibilityUseCase(projects).execute({ projectId: 'p-mem', hidden: true });

		expect(new GetProjectVisibilityUseCase(projects).execute()).toEqual([
			{
				id: 'p-mem',
				name: 'claude-mem-observer-sessions',
				path: '/repo/claude-mem-observer-sessions',
				hidden: true,
			},
			{ id: 'p-app', name: 'app', path: '/repo/app', hidden: false },
		]);
	});

	it('見つからないプロジェクトは変更できない', () => {
		expect(() =>
			new UpdateProjectVisibilityUseCase(projects).execute({ projectId: 'missing', hidden: true }),
		).toThrow(ProjectNotFoundError);
	});
});

describe('マイグレーション 0008', () => {
	it('既存の DB に適用すると、既存のプロジェクトは表示のまま残る', () => {
		const legacyDb = openSqliteDatabase(join(dir, 'legacy.db'));
		const upTo7 = Object.fromEntries(
			Object.entries(migrationFiles).filter(([name]) => !name.includes('/0008_')),
		);
		SqliteMigrator.fromFiles(upTo7).migrate(legacyDb);
		legacyDb
			.prepare('INSERT INTO projects (id, path, last_activity_at) VALUES (?, ?, ?)')
			.run('p-old', '/repo/old', 0);

		expect(SqliteMigrator.fromFiles(migrationFiles).migrate(legacyDb)).toEqual([8]);
		expect(new SqliteProjectRepository(legacyDb).findAll().map((p) => p.id)).toEqual(['p-old']);
		expect(new SqliteProjectRepository(legacyDb).findHiddenIds()).toEqual([]);
		legacyDb.close();
	});
});

describe('updateProjectVisibility（action）', () => {
	it('入力を検証してから変更する', () => {
		const useCase = new UpdateProjectVisibilityUseCase(projects);

		updateProjectVisibility(useCase, { projectId: 'p-mem', hidden: true });
		expect(projects.findHiddenIds()).toEqual(['p-mem']);

		for (const request of [
			null,
			[],
			{ projectId: '', hidden: true },
			{ projectId: 1, hidden: true },
			{ projectId: 'x'.repeat(1001), hidden: true },
			{ projectId: 'p-mem', hidden: 'yes' },
			{ projectId: 'p-mem' },
		]) {
			expect(() => updateProjectVisibility(useCase, request)).toThrow(InvalidIpcRequestError);
		}
	});
});
