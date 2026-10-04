import { describe, expect, it } from 'vitest';
import {
	GetSessionConversationUseCase,
	MAX_CONVERSATION_MESSAGES,
	MAX_MESSAGE_LENGTH,
} from '../../../../../../src/main/backend/application/usecases/get-session-conversation.usecase';
import type { ConversationMessage } from '../../../../../../src/main/backend/domain/gateways/session-log.gateway';
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

		expect(await useCase.execute('s1')).toEqual({
			status: 'ok',
			messages: conversation,
			truncated: false,
		});
	});

	it('発言が多すぎれば新しいほうから残し、長すぎる発言は後ろを切る', async () => {
		const many: ConversationMessage[] = Array.from(
			{ length: MAX_CONVERSATION_MESSAGES + 2 },
			(_, i) => ({
				role: 'user' as const,
				text: `発言${i}`,
			}),
		);
		many[many.length - 1] = { role: 'assistant', text: 'あ'.repeat(MAX_MESSAGE_LENGTH + 5) };
		const useCase = new GetSessionConversationUseCase(
			new InMemorySessionRepository(found()),
			new StubSessionLogAdapter([
				{ projectId: 'p1', sessionId: 's1', entries: [], conversation: many },
			]),
		);

		const result = await useCase.execute('s1');

		if (result?.status !== 'ok') throw new Error('unexpected');
		expect(result.truncated).toBe(true);
		expect(result.messages).toHaveLength(MAX_CONVERSATION_MESSAGES);
		expect(result.messages[0]?.text).toBe('発言2');
		expect(result.messages.at(-1)?.text).toBe(`${'あ'.repeat(MAX_MESSAGE_LENGTH)}…`);
	});

	it('同じセッションの読み込みが実行中なら、ログを重ねて読まない', async () => {
		const stub = logs();
		let reads = 0;
		const gateway = {
			listProjectIds: () => stub.listProjectIds(),
			listSessionFiles: (projectId: string) => stub.listSessionFiles(projectId),
			readEntries: () => Promise.resolve([]),
			readConversation: async (file: Parameters<typeof stub.readConversation>[0]) => {
				reads++;
				return stub.readConversation(file);
			},
		};
		const useCase = new GetSessionConversationUseCase(
			new InMemorySessionRepository(found()),
			gateway,
		);

		const [first, second] = await Promise.all([useCase.execute('s1'), useCase.execute('s1')]);

		expect(first).toEqual(second);
		expect(reads).toBe(1);
		await useCase.execute('s1');
		expect(reads).toBe(2);
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
