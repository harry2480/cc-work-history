import type {
	ConversationMessage,
	SessionLogGateway,
} from '../../domain/gateways/session-log.gateway';
import type { SessionRepository } from '../../domain/repositories/session.repository';

export type SessionConversationView =
	| { status: 'ok'; messages: ConversationMessage[] }
	/** ログファイルが見つからない（削除された・移動されたなど） */
	| { status: 'missing' };

/**
 * セッションの会話（ユーザーとアシスタントの発言のテキスト）をログから読む。
 * DB には保存せず、開くたびにログを読み直す。セッションが見つからなければ null
 */
export class GetSessionConversationUseCase {
	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly sessionLogGateway: SessionLogGateway,
	) {}

	async execute(sessionId: string): Promise<SessionConversationView | null> {
		const found = this.sessionRepository.findById(sessionId);
		if (!found) return null;

		const file = (await this.sessionLogGateway.listSessionFiles(found.project.id)).find(
			(f) => f.sessionId === sessionId,
		);
		if (!file) return { status: 'missing' };
		return { status: 'ok', messages: await this.sessionLogGateway.readConversation(file) };
	}
}
