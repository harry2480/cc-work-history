import type {
	ConversationMessage,
	SessionLogGateway,
} from '../../domain/gateways/session-log.gateway';
import type { SummaryGeneratorGateway } from '../../domain/gateways/summary-generator.gateway';
import type { SessionAnnotationRepository } from '../../domain/repositories/session-annotation.repository';
import type { SessionRepository } from '../../domain/repositories/session.repository';

export type GenerateSummaryResult =
	| { status: 'ok' }
	/** 同じセッションの生成が実行中 */
	| { status: 'busy' }
	/** ログに会話のテキストがない、またはログファイルが見つからない */
	| { status: 'empty' }
	/** Claude CLI がない・失敗したなど。保存はせず、もう一度押せば再試行する */
	| { status: 'unavailable'; reason: string }
	| { status: 'failed'; reason: string };

/** 生成するセッションが見つからないときのエラー */
export class SessionNotFoundError extends Error {
	override name = 'SessionNotFoundError';
}

const ROLE_LABELS = { user: 'ユーザー', assistant: 'アシスタント' } as const;

/**
 * セッションの会話から、Claude CLI で概要とタグを生成して保存する（詳細パネルのボタンから呼ぶ）。
 * 同じセッションの生成は同時に 1 つだけ。手動で編集した概要と手動で付けたタグは残す
 */
export class GenerateSessionSummaryUseCase {
	private readonly running = new Set<string>();

	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly sessionAnnotationRepository: SessionAnnotationRepository,
		private readonly sessionLogGateway: SessionLogGateway,
		private readonly summaryGenerator: SummaryGeneratorGateway,
	) {}

	async execute(sessionId: string): Promise<GenerateSummaryResult> {
		if (this.running.has(sessionId)) return { status: 'busy' };
		this.running.add(sessionId);
		try {
			return await this.generate(sessionId);
		} finally {
			this.running.delete(sessionId);
		}
	}

	private async generate(sessionId: string): Promise<GenerateSummaryResult> {
		const found = this.sessionRepository.findById(sessionId);
		if (!found) throw new SessionNotFoundError(`セッションが見つかりません: ${sessionId}`);
		const { project } = found;

		const file = (await this.sessionLogGateway.listSessionFiles(project.id)).find(
			(f) => f.sessionId === sessionId,
		);
		if (!file) return { status: 'empty' };
		const messages = await this.sessionLogGateway.readConversation(file);
		const conversation = messages ? toConversationText(messages) : '';
		if (!conversation) return { status: 'empty' };

		const result = await this.summaryGenerator.generate({
			projectName: project.name,
			conversation,
		});
		if (result.status !== 'ok') return result;

		// 生成中に手で編集された場合も考え、保存の直前に読み直す
		const annotation = this.sessionAnnotationRepository.findBySessionId(sessionId);
		if (!annotation) throw new SessionNotFoundError(`セッションが見つかりません: ${sessionId}`);
		this.sessionAnnotationRepository.save(
			sessionId,
			annotation.withGenerated({ summary: result.value.summary, tagNames: result.value.tags }),
		);
		return { status: 'ok' };
	}
}

/** 「ユーザー: …」「アシスタント: …」の形式のテキストにする */
function toConversationText(messages: readonly ConversationMessage[]): string {
	return messages.map((m) => `${ROLE_LABELS[m.role]}: ${m.text}`).join('\n\n');
}
