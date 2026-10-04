import { describe, expect, it } from 'vitest';
import {
	GenerateSessionSummaryUseCase,
	SessionNotFoundError,
} from '../../../../../../src/main/backend/application/usecases/generate-session-summary.usecase';
import type { ConversationMessage } from '../../../../../../src/main/backend/domain/gateways/session-log.gateway';
import type {
	SummaryGenerationResult,
	SummaryGeneratorGateway,
	SummaryInput,
} from '../../../../../../src/main/backend/domain/gateways/summary-generator.gateway';
import { Project } from '../../../../../../src/main/backend/domain/models/project.model';
import { SessionAnnotation } from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import { Session } from '../../../../../../src/main/backend/domain/models/session.model';
import type { SessionAnnotationRepository } from '../../../../../../src/main/backend/domain/repositories/session-annotation.repository';
import type {
	SessionRepository,
	SessionWithProject,
} from '../../../../../../src/main/backend/domain/repositories/session.repository';
import { StubSessionLogAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-session-log.adapter';
import { StubSummaryGeneratorAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-summary-generator.adapter';

const at = new Date(Date.UTC(2026, 9, 1, 9));

function found(): SessionWithProject {
	const session = Session.fromLogEntries({
		id: 's1',
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

class InMemoryAnnotationRepository implements SessionAnnotationRepository {
	annotation = SessionAnnotation.empty();
	saves = 0;
	findBySessionId() {
		return this.annotation;
	}
	findBySessionIds(): never {
		throw new Error('not used');
	}
	save(_sessionId: string, annotation: SessionAnnotation) {
		this.annotation = annotation;
		this.saves++;
	}
	findAllTagNames(): never {
		throw new Error('not used');
	}
}

const conversation: ConversationMessage[] = [
	{ role: 'user', text: 'README の誤字を直して' },
	{ role: 'assistant', text: '直しました' },
];

function setup({
	session = found(),
	messages = conversation,
	generator = new StubSummaryGeneratorAdapter(),
}: {
	session?: SessionWithProject | null;
	messages?: ConversationMessage[];
	generator?: SummaryGeneratorGateway;
} = {}) {
	const annotations = new InMemoryAnnotationRepository();
	const logs = new StubSessionLogAdapter([
		{ projectId: 'p1', sessionId: 's1', entries: [], conversation: messages },
	]);
	const useCase = new GenerateSessionSummaryUseCase(
		new InMemorySessionRepository(session),
		annotations,
		logs,
		generator,
	);
	return { annotations, useCase };
}

describe('GenerateSessionSummaryUseCase', () => {
	it('会話を「ユーザー: / アシスタント:」の形式で渡し、生成した概要と自動タグを保存する', async () => {
		const generator = new StubSummaryGeneratorAdapter();
		const { annotations, useCase } = setup({ generator });

		expect(await useCase.execute('s1')).toEqual({ status: 'ok' });

		expect(generator.inputs).toEqual([
			{
				projectName: 'app',
				conversation: 'ユーザー: README の誤字を直して\n\nアシスタント: 直しました',
			},
		]);
		expect(annotations.annotation.summary).toBe('（Stub）セッションの概要');
		expect(annotations.annotation.tags.map((t) => [t.tag.name, t.source])).toEqual([
			['stub', 'auto'],
		]);
	});

	it('同じセッションの生成が実行中なら、もう 1 つは始めない', async () => {
		let finish: (result: SummaryGenerationResult) => void = () => {};
		const calls: SummaryInput[] = [];
		const generator: SummaryGeneratorGateway = {
			generate: (input) => {
				calls.push(input);
				return new Promise((resolve) => {
					finish = resolve;
				});
			},
		};
		const { useCase } = setup({ generator });

		const first = useCase.execute('s1');
		await new Promise((r) => setTimeout(r, 0));
		expect(await useCase.execute('s1')).toEqual({ status: 'busy' });

		finish({ status: 'ok', value: { summary: '概要', tags: [] } });
		expect(await first).toEqual({ status: 'ok' });
		expect(calls).toHaveLength(1);
		// 終わったらまた生成できる
		const again = useCase.execute('s1');
		await new Promise((r) => setTimeout(r, 0));
		finish({ status: 'ok', value: { summary: '概要', tags: [] } });
		expect(await again).toEqual({ status: 'ok' });
	});

	it('会話のテキストがなければ、生成せずに empty を返す', async () => {
		const generator = new StubSummaryGeneratorAdapter();
		const { annotations, useCase } = setup({ messages: [], generator });

		expect(await useCase.execute('s1')).toEqual({ status: 'empty' });
		expect(generator.inputs).toEqual([]);
		expect(annotations.saves).toBe(0);
	});

	it('Claude CLI が使えない・失敗したときは保存せず、理由を返す', async () => {
		const generator = new StubSummaryGeneratorAdapter({
			status: 'unavailable',
			reason: 'Claude CLI が見つかりません',
		});
		const { annotations, useCase } = setup({ generator });

		expect(await useCase.execute('s1')).toEqual({
			status: 'unavailable',
			reason: 'Claude CLI が見つかりません',
		});
		expect(annotations.saves).toBe(0);
	});

	it('生成中に手で編集された概要は上書きしない（保存の直前に読み直す）', async () => {
		let annotations: InMemoryAnnotationRepository | null = null;
		const generator: SummaryGeneratorGateway = {
			generate: async () => {
				annotations?.save(
					's1',
					SessionAnnotation.restore({
						summary: '手で書いた',
						summaryEditedManually: true,
						tags: [],
					}),
				);
				return { status: 'ok', value: { summary: '生成した', tags: [] } };
			},
		};
		const context = setup({ generator });
		annotations = context.annotations;

		await context.useCase.execute('s1');

		expect(context.annotations.annotation.summary).toBe('手で書いた');
	});

	it('セッションが見つからなければエラーにする', async () => {
		const { useCase } = setup({ session: null });

		await expect(useCase.execute('missing')).rejects.toThrow(SessionNotFoundError);
	});
});
