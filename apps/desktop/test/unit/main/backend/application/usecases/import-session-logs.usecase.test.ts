import { describe, expect, it, vi } from 'vitest';
import { ImportSessionLogsUseCase } from '../../../../../../src/main/backend/application/usecases/import-session-logs.usecase';
import type {
	SessionLogFile,
	SessionLogGateway,
} from '../../../../../../src/main/backend/domain/gateways/session-log.gateway';
import type { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import type { SessionLogEntry } from '../../../../../../src/main/backend/domain/models/session-log-entry.model';
import type { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import type { ProjectRepository } from '../../../../../../src/main/backend/domain/repositories/project.repository';
import type { SessionLogFileRepository } from '../../../../../../src/main/backend/domain/repositories/session-log-file.repository';
import type { SessionRepository } from '../../../../../../src/main/backend/domain/repositories/session.repository';
import {
	type StubSession,
	StubSessionLogAdapter,
} from '../../../../../../src/main/backend/infrastructure/adapters/stub-session-log.adapter';

class InMemoryProjectRepository implements ProjectRepository {
	readonly projects = new Map<string, Project>();
	save(project: Project) {
		this.projects.set(project.id, project);
	}
	findById(id: string) {
		return this.projects.get(id) ?? null;
	}
}

class InMemorySessionRepository implements SessionRepository {
	readonly sessions = new Map<string, Session>();
	save(session: Session) {
		this.sessions.set(session.id, session);
	}
	findById(): never {
		throw new Error('not used');
	}
	findByPeriod(): never {
		throw new Error('not used');
	}
}

class InMemorySessionLogFileRepository implements SessionLogFileRepository {
	readonly files = new Map<string, SessionLogFile>();
	findAll() {
		return new Map(this.files);
	}
	save(file: SessionLogFile) {
		this.files.set(file.path, file);
	}
}

const t0 = new Date('2026-10-01T09:00:00Z').getTime();
const msg = (min: number, cwd = '/repo/app'): SessionLogEntry => ({
	timestamp: new Date(t0 + min * 60_000),
	role: 'user',
	inputTokens: 1,
	outputTokens: 0,
	cwd,
});

function setup(stubSessions: StubSession[], gateway?: SessionLogGateway) {
	const repos = {
		projects: new InMemoryProjectRepository(),
		sessions: new InMemorySessionRepository(),
		files: new InMemorySessionLogFileRepository(),
	};
	const yieldControl = vi.fn(async () => {});
	const run = (sessions = stubSessions, batchSize = 50) =>
		new ImportSessionLogsUseCase(
			gateway ?? new StubSessionLogAdapter(sessions),
			repos.projects,
			repos.sessions,
			repos.files,
			{ batchSize, yieldControl },
		).execute();
	return { repos, run, yieldControl };
}

describe('ImportSessionLogsUseCase', () => {
	it('初回はすべてのファイルを取り込み、プロジェクトを作業ディレクトリから作る', async () => {
		const { repos, run } = setup([
			{ projectId: 'p1', sessionId: 's1', entries: [msg(0), msg(10)] },
			{ projectId: 'p1', sessionId: 's2', entries: [msg(60)] },
			{ projectId: 'p2', sessionId: 's3', entries: [msg(5, '/repo/other')] },
		]);

		const result = await run();

		expect(result).toEqual({
			scanned: 3,
			imported: 3,
			unchanged: 0,
			empty: 0,
			failures: [],
			importedSessions: expect.any(Array),
		});
		expect([...repos.sessions.sessions.keys()]).toEqual(['s1', 's2', 's3']);
		expect(repos.projects.findById('p1')?.path).toBe('/repo/app');
		// プロジェクトの最終活動日時は最も新しいセッションの終了時刻
		expect(repos.projects.findById('p1')?.lastActivityAt).toEqual(new Date(t0 + 60 * 60_000));
		expect(repos.files.files.size).toBe(3);
	});

	it('2 回目は更新日時・サイズが変わったファイルだけを取り込む', async () => {
		const sessions: StubSession[] = [
			{ projectId: 'p1', sessionId: 's1', entries: [msg(0)], modifiedAt: new Date(1) },
			{ projectId: 'p1', sessionId: 's2', entries: [msg(1)], modifiedAt: new Date(1) },
		];
		const { repos, run } = setup(sessions);
		await run();

		const updated: StubSession[] = [
			sessions[0] as StubSession,
			{ projectId: 'p1', sessionId: 's2', entries: [msg(1), msg(2)], modifiedAt: new Date(2) },
		];
		const result = await run(updated);

		expect(result).toMatchObject({ scanned: 2, imported: 1, unchanged: 1 });
		expect(repos.sessions.sessions.get('s2')?.messageCount).toBe(2);
	});

	it('メッセージを含まないファイルは取り込まず、次回は読まない', async () => {
		const { repos, run } = setup([{ projectId: 'p1', sessionId: 'empty', entries: [] }]);

		expect(await run()).toMatchObject({ imported: 0, empty: 1 });
		expect(repos.sessions.sessions.size).toBe(0);
		expect(await run()).toMatchObject({ unchanged: 1, empty: 0 });
	});

	it('読み取りに失敗したファイルは記録して、他のファイルの取り込みを続ける', async () => {
		const stub = new StubSessionLogAdapter([
			{ projectId: 'p1', sessionId: 'broken', entries: [msg(0)] },
			{ projectId: 'p1', sessionId: 'ok', entries: [msg(0)] },
		]);
		const gateway: SessionLogGateway = {
			listProjectIds: () => stub.listProjectIds(),
			listSessionFiles: (id) => stub.listSessionFiles(id),
			readEntries: async (file) => {
				if (file.sessionId === 'broken') throw new Error('EACCES');
				return stub.readEntries(file);
			},
		};
		const { repos, run } = setup([], gateway);

		const result = await run();

		expect(result.imported).toBe(1);
		expect(result.failures).toEqual([{ path: 'stub://p1/broken.jsonl', reason: 'Error: EACCES' }]);
		expect([...repos.sessions.sessions.keys()]).toEqual(['ok']);
		// 失敗したファイルは記録しないので、次回に再試行される
		expect(repos.files.files.has('stub://p1/broken.jsonl')).toBe(false);
	});

	it('バッチの件数ごとにイベントループへ制御を返す', async () => {
		const sessions = Array.from({ length: 7 }, (_, i) => ({
			projectId: 'p1',
			sessionId: `s${i}`,
			entries: [msg(i)],
		}));
		const { run, yieldControl } = setup(sessions);

		await run(sessions, 3);

		expect(yieldControl).toHaveBeenCalledTimes(2);
	});

	it('作業ディレクトリが取れないセッションはディレクトリ名をプロジェクトのパスにする', async () => {
		const { repos, run } = setup([
			{ projectId: '-Users-me-x', sessionId: 's1', entries: [{ ...msg(0), cwd: undefined }] },
		]);

		await run();

		expect(repos.projects.findById('-Users-me-x')?.path).toBe('-Users-me-x');
	});
});

describe('ImportSessionLogsUseCase（対象の絞り込みと結果）', () => {
	it('projectIds を指定するとそのプロジェクトだけを取り込み、取り込んだセッションを返す', async () => {
		const { repos, run } = setup([]);
		const stub = new StubSessionLogAdapter([
			{ projectId: 'p1', sessionId: 's1', entries: [msg(0), msg(10)] },
			{ projectId: 'p2', sessionId: 's2', entries: [msg(5)] },
		]);
		const result = await new ImportSessionLogsUseCase(
			stub,
			repos.projects,
			repos.sessions,
			repos.files,
		).execute({ projectIds: ['p1'] });

		expect(result.scanned).toBe(1);
		expect(result.importedSessions).toEqual([
			{ id: 's1', startedAt: new Date(t0), endedAt: new Date(t0 + 10 * 60_000) },
		]);
		expect([...repos.sessions.sessions.keys()]).toEqual(['s1']);
	});
});
