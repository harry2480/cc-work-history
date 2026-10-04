import { describe, expect, it } from 'vitest';
import { GetSessionConversationUseCase } from '../../../../../../src/main/backend/application/usecases/get-session-conversation.usecase';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import type {
	SessionRepository,
	SessionWithProject,
} from '../../../../../../src/main/backend/domain/repositories/session.repository';
import { StubSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-session-log.adapter';

const at = new Date(Date.UTC(2026, 9, 1, 9));

function found(id = 's1'): SessionWithProject {
	const session = Session.fromLogEntries({
		id,
		projectId: 'p1',
		entries: [{ timestamp: at, role: 'user', inputTokens: 0, outputTokens: 0 }],
	});
	const project = Project.create({ id: 'p1', path: '/repo/app', lastActivityAt: at });
	if (!session.success || !project.success) throw new Error('fixture');
	return { session: session.value, project: project.value };
}

class InMemorySessionRepository implements SessionRepository {
	constructor(private readonly value: SessionWithProject | null) {}
	save(): never {
		throw new Error('not used');
	}
	findById() {
		return this.value;
	}
	findByPeriod(): never {
		throw new Error('not used');
	}
	search(): never {
		throw new Error('not used');
	}
}

const conversation = [
	{ role: 'user' as const, text: 'README の誤字を直して' },
	{ role: 'assistant' as const, text: '直しました' },
];

function logs(sessionId = 's1') {
	return new StubSessionLogAdapter([{ projectId: 'p1', sessionId, entries: [], conversation }]);
}

describe('GetSessionConversationUseCase', () => {
	it('セッションのログから会話を読む', async () => {
		const useCase = new GetSessionConversationUseCase(
			new InMemorySessionRepository(found()),
			logs(),
		);

		expect(await useCase.execute('s1')).toEqual({ status: 'ok', messages: conversation });
	});

	it('ログファイルが見つからなければ missing', async () => {
		const useCase = new GetSessionConversationUseCase(
			new InMemorySessionRepository(found()),
			logs('other'),
		);

		expect(await useCase.execute('s1')).toEqual({ status: 'missing' });
	});

	it('セッションが見つからなければ null', async () => {
		const useCase = new GetSessionConversationUseCase(new InMemorySessionRepository(null), logs());

		expect(await useCase.execute('s1')).toBeNull();
	});
});
