import { describe, expect, it } from 'vitest';
import {
	ResumeSessionUseCase,
	SessionNotFoundError,
} from '../../../../../../src/main/backend/application/usecases/resume-session.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import type {
	SessionRepository,
	SessionWithProject,
} from '../../../../../../src/main/backend/domain/repositories/session.repository';
import { StubTerminalLauncherAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-terminal-launcher.adapter';

function sessionWith(cwd: string | undefined): SessionWithProject {
	const session = Session.fromLogEntries({
		id: 's1',
		projectId: 'p1',
		entries: [{ timestamp: new Date(), role: 'user', inputTokens: 0, outputTokens: 0, cwd }],
	});
	const project = Project.create({ id: 'p1', path: '/repo/app', lastActivityAt: new Date() });
	if (!session.success || !project.success) throw new Error('fixture');
	return { session: session.value, project: project.value };
}

class InMemorySessionRepository implements SessionRepository {
	constructor(private readonly found: SessionWithProject | null) {}
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

describe('ResumeSessionUseCase', () => {
	it('セッションの作業ディレクトリで再開する', async () => {
		const launcher = new StubTerminalLauncherAdapter();
		const useCase = new ResumeSessionUseCase(
			new InMemorySessionRepository(sessionWith('/repo/app/web')),
			launcher,
		);

		expect(await useCase.execute('s1')).toEqual({ status: 'ok' });
		expect(launcher.targets).toEqual([{ cwd: '/repo/app/web', sessionId: 's1' }]);
	});

	it('作業ディレクトリがログになければプロジェクトのパスを使う', async () => {
		const launcher = new StubTerminalLauncherAdapter();
		const useCase = new ResumeSessionUseCase(
			new InMemorySessionRepository(sessionWith(undefined)),
			launcher,
		);

		await useCase.execute('s1');

		expect(launcher.targets[0]?.cwd).toBe('/repo/app');
	});

	it('ターミナルを開けなかった結果をそのまま返す', async () => {
		const launcher = new StubTerminalLauncherAdapter({
			status: 'unsupported',
			reason: 'macOS のみ',
		});
		const useCase = new ResumeSessionUseCase(
			new InMemorySessionRepository(sessionWith('/repo/app')),
			launcher,
		);

		expect(await useCase.execute('s1')).toEqual({ status: 'unsupported', reason: 'macOS のみ' });
	});

	it('セッションが見つからなければエラーにする', async () => {
		const launcher = new StubTerminalLauncherAdapter();
		const useCase = new ResumeSessionUseCase(new InMemorySessionRepository(null), launcher);

		await expect(useCase.execute('missing')).rejects.toThrow(SessionNotFoundError);
		expect(launcher.targets).toEqual([]);
	});
});
