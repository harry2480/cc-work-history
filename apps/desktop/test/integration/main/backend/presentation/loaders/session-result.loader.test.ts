import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GetSessionResultUseCase } from '../../../../../../src/main/backend/application/usecases/get-session-result.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { SessionResult } from '../../../../../../src/main/backend/domain/models/session-result.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { StubGitAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-git.adapter';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionResultRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session-result.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { loadSessionResult } from '../../../../../../src/main/backend/presentation/loaders/session-result.loader';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

const at = (hour: number) => new Date(Date.UTC(2026, 9, 1, hour));

let dir: string;
let db: Database.Database;
let results: SqliteSessionResultRepository;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	const project = Project.create({ id: 'p1', path: '/repo/app', lastActivityAt: at(11) });
	const session = Session.fromLogEntries({
		id: 's1',
		projectId: 'p1',
		entries: [at(9), at(11)].map((timestamp) => ({
			timestamp,
			role: 'user' as const,
			inputTokens: 0,
			outputTokens: 0,
			cwd: '/repo/app',
		})),
	});
	if (!project.success || !session.success) throw new Error('fixture');
	new SqliteProjectRepository(db).save(project.value);
	new SqliteSessionRepository(db).save(session.value);
	results = new SqliteSessionResultRepository(db);
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('SqliteSessionResultRepository', () => {
	it('保存した成果を読み出し、保存し直すと置き換える', () => {
		const first = SessionResult.create({
			kind: 'commits',
			commitCount: 2,
			changedFileCount: 3,
			sessionEndedAt: at(11),
			computedAt: at(12),
		});
		const second = SessionResult.create({
			kind: 'no_repository',
			sessionEndedAt: at(11),
			computedAt: at(13),
		});
		if (!first.success || !second.success) throw new Error('fixture');

		expect(results.findBySessionId('s1')).toBeNull();
		results.save('s1', first.value);
		expect(results.findBySessionId('s1')?.value).toEqual({
			kind: 'commits',
			commitCount: 2,
			changedFileCount: 3,
		});

		results.save('s1', second.value);
		const saved = results.findBySessionId('s1');
		expect(saved?.value).toEqual({ kind: 'no_repository' });
		expect(saved?.computedAt).toEqual(at(13));
	});

	it('セッションを消すと成果も消える', () => {
		const result = SessionResult.create({
			kind: 'no_repository',
			sessionEndedAt: at(11),
			computedAt: at(12),
		});
		if (!result.success) throw new Error(result.error);
		results.save('s1', result.value);

		db.prepare('DELETE FROM sessions WHERE id = ?').run('s1');

		expect(results.findBySessionId('s1')).toBeNull();
	});
});

describe('loadSessionResult（SQLite + Stub の git）', () => {
	const useCase = () =>
		new GetSessionResultUseCase(new SqliteSessionRepository(db), results, new StubGitAdapter());

	it('集計結果を DTO にし、保存する', async () => {
		expect(await loadSessionResult(useCase(), { id: 's1' }, at(20))).toEqual({
			status: 'commits',
			commitCount: 3,
			changedFileCount: 5,
			computedAt: at(20).toISOString(),
		});
		expect(results.findBySessionId('s1')).not.toBeNull();
	});

	it('セッションが見つからなければ null', async () => {
		expect(await loadSessionResult(useCase(), { id: 'missing' }, at(20))).toBeNull();
	});

	it.each([null, [], {}, { id: '' }, { id: 1 }, { id: 'x'.repeat(201) }])(
		'不正なリクエスト %j は弾く',
		async (request) => {
			await expect(loadSessionResult(useCase(), request, at(20))).rejects.toThrow(
				InvalidIpcRequestError,
			);
		},
	);
});
