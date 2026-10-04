import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GetSessionConversationUseCase } from '../../../../../../src/main/backend/application/usecases/get-session-conversation.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { StubSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-session-log.adapter';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { loadSessionConversation } from '../../../../../../src/main/backend/presentation/loaders/session-conversation.loader';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

const at = new Date(Date.UTC(2026, 9, 1, 9));
const conversation = [
	{ role: 'user' as const, text: 'README の誤字を直して' },
	{ role: 'assistant' as const, text: '直しました' },
];

let dir: string;
let db: Database.Database;
let useCase: GetSessionConversationUseCase;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	const project = Project.create({ id: 'p1', path: '/repo/app', lastActivityAt: at });
	const session = Session.fromLogEntries({
		id: 's1',
		projectId: 'p1',
		entries: [{ timestamp: at, role: 'user', inputTokens: 0, outputTokens: 0 }],
	});
	if (!project.success || !session.success) throw new Error('fixture');
	new SqliteProjectRepository(db).save(project.value);
	new SqliteSessionRepository(db).save(session.value);
	useCase = new GetSessionConversationUseCase(
		new SqliteSessionRepository(db),
		new StubSessionLogAdapter([{ projectId: 'p1', sessionId: 's1', entries: [], conversation }]),
	);
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('loadSessionConversation（SQLite + Stub のログ）', () => {
	it('セッションの会話を返す', async () => {
		expect(await loadSessionConversation(useCase, { id: 's1' })).toEqual({
			status: 'ok',
			messages: conversation,
			truncated: false,
		});
	});

	it('セッションが見つからなければ null', async () => {
		expect(await loadSessionConversation(useCase, { id: 'missing' })).toBeNull();
	});

	it('不正なリクエストは断る', () => {
		for (const request of [null, [], 'id', { id: '' }, { id: 1 }, { id: 'x'.repeat(201) }]) {
			expect(() => loadSessionConversation(useCase, request)).toThrow(InvalidIpcRequestError);
		}
	});
});
