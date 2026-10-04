import { describe, expect, it } from 'vitest';
import { GetSessionResultUseCase } from '../../../../../../src/main/backend/application/usecases/get-session-result.usecase';
import type { CommitStatsResult } from '../../../../../../src/main/backend/domain/gateways/git.gateway';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import type { SessionResult } from '../../../../../../src/main/backend/domain/models/session-result.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import type { SessionResultRepository } from '../../../../../../src/main/backend/domain/repositories/session-result.repository';
import type {
	SessionRepository,
	SessionWithProject,
} from '../../../../../../src/main/backend/domain/repositories/session.repository';
import { StubGitAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-git.adapter';

const at = (hour: number, min = 0) => new Date(Date.UTC(2026, 9, 1, hour, min));
const LATER = at(20);

function sessionEndingAt(end: Date, cwd: string | null = '/repo/app/web'): SessionWithProject {
	const entries = [at(9), end].map((timestamp) => ({
		timestamp,
		role: 'user' as const,
		inputTokens: 0,
		outputTokens: 0,
		cwd: cwd ?? undefined,
	}));
	const session = Session.fromLogEntries({ id: 's1', projectId: 'p1', entries });
	const project = Project.create({ id: 'p1', path: '/repo/app', lastActivityAt: end });
	if (!session.success || !project.success) throw new Error('fixture');
	return { session: session.value, project: project.value };
}

class InMemorySessionRepository implements SessionRepository {
	constructor(public found: SessionWithProject | null) {}
	save(): never {
		throw new Error('not used');
	}
	findById() {
		return this.found;
	}
	findByPeriod(): never {
		throw new Error('not used');
	}
	search(): never {
		throw new Error('not used');
	}
}

class InMemorySessionResultRepository implements SessionResultRepository {
	readonly results = new Map<string, SessionResult>();
	findBySessionId(sessionId: string) {
		return this.results.get(sessionId) ?? null;
	}
	save(sessionId: string, result: SessionResult) {
		this.results.set(sessionId, result);
	}
}

function setup(found: SessionWithProject | null, gitResult?: CommitStatsResult) {
	const sessions = new InMemorySessionRepository(found);
	const results = new InMemorySessionResultRepository();
	const git = new StubGitAdapter(gitResult);
	const useCase = new GetSessionResultUseCase(sessions, results, git);
	return { sessions, results, git, useCase };
}

describe('GetSessionResultUseCase', () => {
	it('セッションの作業ディレクトリと期間で git から集計し、保存する', async () => {
		const { results, git, useCase } = setup(sessionEndingAt(at(11)));

		expect(await useCase.execute('s1', LATER)).toEqual({
			status: 'commits',
			commitCount: 3,
			changedFileCount: 5,
			computedAt: LATER,
		});
		expect(git.queries).toEqual([{ cwd: '/repo/app/web', since: at(9), until: at(11) }]);
		expect(results.findBySessionId('s1')?.value).toEqual({
			kind: 'commits',
			commitCount: 3,
			changedFileCount: 5,
		});
	});

	it('完了したセッションは、保存済みの集計を使って git を呼ばない', async () => {
		const { git, useCase } = setup(sessionEndingAt(at(11)));
		await useCase.execute('s1', LATER);

		await useCase.execute('s1', at(21));

		expect(git.queries).toHaveLength(1);
	});

	it('集計したあとにセッションが更新されていたら集計し直す', async () => {
		const { sessions, git, useCase } = setup(sessionEndingAt(at(11)));
		await useCase.execute('s1', LATER);

		sessions.found = sessionEndingAt(at(12));
		await useCase.execute('s1', LATER);

		expect(git.queries).toHaveLength(2);
		expect(git.queries[1]?.until).toEqual(at(12));
	});

	it('進行中のセッションは、開くたびに集計し直す', async () => {
		const { git, useCase } = setup(sessionEndingAt(at(11)));
		const whileActive = at(11, 10);

		await useCase.execute('s1', whileActive);
		await useCase.execute('s1', whileActive);

		expect(git.queries).toHaveLength(2);
	});

	it('作業ディレクトリがログになければプロジェクトのパスで集計する', async () => {
		const { git, useCase } = setup(sessionEndingAt(at(11), null));

		await useCase.execute('s1', LATER);

		expect(git.queries[0]?.cwd).toBe('/repo/app');
	});

	it('git リポジトリでなければ「なし」として保存する', async () => {
		const { results, useCase } = setup(sessionEndingAt(at(11)), { status: 'no_repository' });

		expect(await useCase.execute('s1', LATER)).toEqual({ status: 'no_repository' });
		expect(results.findBySessionId('s1')?.value).toEqual({ kind: 'no_repository' });
	});

	it('集計できなかったときは保存せず、次に開いたときにもう一度試す', async () => {
		const { results, useCase } = setup(sessionEndingAt(at(11)), {
			status: 'unavailable',
			reason: 'git が見つかりません',
		});

		expect(await useCase.execute('s1', LATER)).toEqual({
			status: 'unavailable',
			reason: 'git が見つかりません',
		});
		expect(results.findBySessionId('s1')).toBeNull();
	});

	it('同じセッションの集計が実行中なら、git を重ねて実行せずに同じ結果を返す', async () => {
		const { git, useCase } = setup(sessionEndingAt(at(11)));
		const whileActive = at(11, 10);

		const [a, b] = await Promise.all([
			useCase.execute('s1', whileActive),
			useCase.execute('s1', whileActive),
		]);

		expect(git.queries).toHaveLength(1);
		expect(a).toEqual(b);
	});

	it('セッションが見つからなければ null', async () => {
		const { git, useCase } = setup(null);

		expect(await useCase.execute('missing', LATER)).toBeNull();
		expect(git.queries).toEqual([]);
	});
});
