import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UpdateSessionAnnotationUseCase } from '../../../../../../src/main/backend/application/usecases/update-session-annotation.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { SessionAnnotation } from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteProjectRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-project.repository';
import { SqliteSessionAnnotationRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session-annotation.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { updateSessionAnnotation } from '../../../../../../src/main/backend/presentation/actions/session-annotation.action';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

let dir: string;
let db: Database.Database;
let sessions: SqliteSessionRepository;
let annotations: SqliteSessionAnnotationRepository;

function saveSession(id: string, messageCount = 1) {
	const entries = Array.from({ length: messageCount }, (_, i) => ({
		timestamp: new Date(Date.UTC(2026, 9, 1, 9, i)),
		role: 'user' as const,
		inputTokens: 1,
		outputTokens: 0,
	}));
	const session = Session.fromLogEntries({ id, projectId: 'p1', entries });
	if (!session.success) throw new Error(session.error);
	sessions.save(session.value);
}

function manual(summary: string | null, tagNames: string[]) {
	const annotation = SessionAnnotation.editManually({ summary, tagNames });
	if (!annotation.success) throw new Error(annotation.error);
	return annotation.value;
}

const tagCount = () => (db.prepare('SELECT COUNT(*) AS n FROM tags').get() as { n: number }).n;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	const project = Project.create({ id: 'p1', path: '/repo/app', lastActivityAt: new Date() });
	if (!project.success) throw new Error(project.error);
	new SqliteProjectRepository(db).save(project.value);
	sessions = new SqliteSessionRepository(db);
	annotations = new SqliteSessionAnnotationRepository(db);
	saveSession('s1');
	saveSession('s2');
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('SqliteSessionAnnotationRepository', () => {
	it('概要とタグを保存して取得できる。概要もタグもないセッションは空の注釈', () => {
		annotations.save('s1', manual('README を直した', ['docs', 'README']));

		const found = annotations.findBySessionId('s1');
		expect(found?.summary).toBe('README を直した');
		expect(found?.summaryEditedManually).toBe(true);
		expect(found?.tags.map((t) => [t.tag.name, t.source])).toEqual([
			['docs', 'manual'],
			['README', 'manual'],
		]);
		expect(annotations.findBySessionId('s2')).toEqual(SessionAnnotation.empty());
		expect(annotations.findBySessionId('missing')).toBeNull();
	});

	it('タグは大文字小文字を区別せずに共有し、どのセッションにも付いていないタグは消す', () => {
		annotations.save('s1', manual(null, ['README']));
		annotations.save('s2', manual(null, ['readme', 'docs']));
		expect(tagCount()).toBe(2);

		annotations.save('s1', manual(null, []));
		annotations.save('s2', manual(null, ['docs']));
		expect(tagCount()).toBe(1);
	});

	it('findBySessionIds は概要かタグのあるセッションだけを返す', () => {
		annotations.save('s1', manual('要約', []));

		expect([...annotations.findBySessionIds(['s1', 's2']).keys()]).toEqual(['s1']);
		expect(annotations.findBySessionIds([])).toEqual(new Map());
	});

	it('ログの再取り込み（セッションの upsert）では概要とタグが消えない', () => {
		annotations.save('s1', manual('要約', ['docs']));
		saveSession('s1', 3);

		expect(annotations.findBySessionId('s1')?.summary).toBe('要約');
		expect(annotations.findBySessionId('s1')?.tagNames).toEqual(['docs']);
	});

	it('存在しないセッションには保存できない', () => {
		expect(() => annotations.save('missing', manual('x', []))).toThrow(/見つかりません/);
	});
});

describe('updateSessionAnnotation（action）', () => {
	const useCase = () => new UpdateSessionAnnotationUseCase(annotations);

	it('リクエストを検証して保存する', () => {
		updateSessionAnnotation(useCase(), { id: 's1', summary: '要約', tags: ['a', 'b'] });

		expect(annotations.findBySessionId('s1')?.tagNames).toEqual(['a', 'b']);
	});

	it.each([
		['オブジェクトでない', 'x'],
		['ID がない', { summary: null, tags: [] }],
		['概要が文字列でも null でもない', { id: 's1', summary: 1, tags: [] }],
		['タグが配列でない', { id: 's1', summary: null, tags: 'a' }],
		['タグに文字列以外', { id: 's1', summary: null, tags: [1] }],
		['概要が長すぎる', { id: 's1', summary: 'x'.repeat(5001), tags: [] }],
	])('不正なリクエスト（%s）はエラーにする', (_label, request) => {
		expect(() => updateSessionAnnotation(useCase(), request)).toThrow(InvalidIpcRequestError);
	});
});
