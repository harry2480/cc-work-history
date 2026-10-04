import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	ResumeSessionUseCase,
	SessionNotFoundError,
} from '../../../../../../src/main/backend/application/usecases/resume-session.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { StubTerminalLauncherAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-terminal-launcher.adapter';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { resumeSession } from '../../../../../../src/main/backend/presentation/actions/session-resume.action';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

let dir: string;
let db: Database.Database;
let launcher: StubTerminalLauncherAdapter;
let useCase: ResumeSessionUseCase;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	const project = Project.create({ id: 'p1', path: '/repo/app', lastActivityAt: new Date() });
	const session = Session.fromLogEntries({
		id: 's1',
		projectId: 'p1',
		entries: [
			{
				timestamp: new Date(),
				role: 'user',
				inputTokens: 0,
				outputTokens: 0,
				cwd: '/repo/app/web',
			},
		],
	});
	if (!project.success || !session.success) throw new Error('fixture');
	new SqliteProjectRepository(db).save(project.value);
	const sessions = new SqliteSessionRepository(db);
	sessions.save(session.value);
	launcher = new StubTerminalLauncherAdapter();
	useCase = new ResumeSessionUseCase(sessions, launcher);
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('resumeSession（SQLite）', () => {
	it('保存済みのセッションの作業ディレクトリで再開する', async () => {
		expect(await resumeSession(useCase, { id: 's1' })).toEqual({ status: 'ok' });
		expect(launcher.targets).toEqual([{ cwd: '/repo/app/web', sessionId: 's1' }]);
	});

	it('見つからないセッションはエラーにする', async () => {
		await expect(resumeSession(useCase, { id: 'missing' })).rejects.toThrow(SessionNotFoundError);
	});

	it.each([null, [], {}, { id: '' }, { id: 1 }, { id: 'x'.repeat(201) }])(
		'不正なリクエスト %j は弾く',
		(request) => {
			expect(() => resumeSession(useCase, request)).toThrow(InvalidIpcRequestError);
			expect(launcher.targets).toEqual([]);
		},
	);
});
