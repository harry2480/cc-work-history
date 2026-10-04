import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GenerateSessionSummaryUseCase } from '../../../../../../src/main/backend/application/usecases/generate-session-summary.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { SessionAnnotation } from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { StubSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-session-log.adapter';
import { StubSummaryGeneratorAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-summary-generator.adapter';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionAnnotationRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session-annotation.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { generateSessionSummary } from '../../../../../../src/main/backend/presentation/actions/session-summary.action';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

let dir: string;
let db: Database.Database;
let annotations: SqliteSessionAnnotationRepository;
let useCase: GenerateSessionSummaryUseCase;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	const at = new Date(Date.UTC(2026, 9, 1, 9));
	const project = Project.create({ id: 'p1', path: '/repo/app', lastActivityAt: at });
	const session = Session.fromLogEntries({
		id: 's1',
		projectId: 'p1',
		entries: [{ timestamp: at, role: 'user', inputTokens: 0, outputTokens: 0 }],
	});
	if (!project.success || !session.success) throw new Error('fixture');
	new SqliteProjectRepository(db).save(project.value);
	const sessions = new SqliteSessionRepository(db);
	sessions.save(session.value);
	annotations = new SqliteSessionAnnotationRepository(db);
	useCase = new GenerateSessionSummaryUseCase(
		sessions,
		annotations,
		new StubSessionLogAdapter([
			{
				projectId: 'p1',
				sessionId: 's1',
				entries: [],
				conversation: [{ role: 'user', text: '依頼' }],
			},
		]),
		new StubSummaryGeneratorAdapter({
			status: 'ok',
			value: { summary: '生成した概要', tags: ['docs', 'Electron'] },
		}),
	);
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('generateSessionSummary（SQLite + Stub）', () => {
	it('生成した概要と自動タグを保存し、手で付けたタグは残す', async () => {
		const manual = SessionAnnotation.editManually({ summary: null, tagNames: ['electron'] });
		if (!manual.success) throw new Error(manual.error);
		// 手で付けたタグだけがあり、概要は手で書いていない状態にする
		annotations.save(
			's1',
			SessionAnnotation.restore({
				summary: null,
				summaryEditedManually: false,
				tags: manual.value.tags,
			}),
		);

		expect(await generateSessionSummary(useCase, { id: 's1' })).toEqual({ status: 'ok' });

		const saved = annotations.findBySessionId('s1');
		expect(saved?.summary).toBe('生成した概要');
		expect(saved?.summaryEditedManually).toBe(false);
		expect(saved?.tags.map((t) => [t.tag.name, t.source])).toEqual([
			['electron', 'manual'],
			['docs', 'auto'],
		]);
	});

	it.each([null, [], {}, { id: '' }, { id: 1 }, { id: 'x'.repeat(201) }])(
		'不正なリクエスト %j は弾く',
		(request) => {
			expect(() => generateSessionSummary(useCase, request)).toThrow(InvalidIpcRequestError);
		},
	);
});
