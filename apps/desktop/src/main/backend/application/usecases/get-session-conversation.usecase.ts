import type {
	ConversationMessage,
	SessionLogGateway,
} from '../../domain/gateways/session-log.gateway';
import type { SessionRepository } from '../../domain/repositories/session.repository';

/** 画面に渡す発言の数の上限。超えたら新しいほうから残す */
export const MAX_CONVERSATION_MESSAGES = 1000;
/** 1 発言の文字数の上限。超えたら後ろを切る */
export const MAX_MESSAGE_LENGTH = 20_000;

export type SessionConversationView =
	| {
			status: 'ok';
			messages: ConversationMessage[];
			/** 古い発言を省いた、または長い発言を途中で切った */
			truncated: boolean;
	  }
	/** ログファイルが見つからない（削除された・移動されたなど） */
	| { status: 'missing' };

/**
 * セッションの会話（ユーザーとアシスタントの発言のテキスト）をログから読む。
 * DB には保存せず、開くたびにログを読み直す。セッションが見つからなければ null
 */
export class GetSessionConversationUseCase {
	/** 同じセッションの読み込みが実行中なら、その結果を使う（大きなログを重ねて読まない） */
	private readonly running = new Map<string, Promise<SessionConversationView | null>>();

	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly sessionLogGateway: SessionLogGateway,
	) {}

	execute(sessionId: string): Promise<SessionConversationView | null> {
		const running = this.running.get(sessionId);
		if (running) return running;
		const task = this.read(sessionId).finally(() => this.running.delete(sessionId));
		this.running.set(sessionId, task);
		return task;
	}

	private async read(sessionId: string): Promise<SessionConversationView | null> {
		const found = this.sessionRepository.findById(sessionId);
		if (!found) return null;

		const file = (await this.sessionLogGateway.listSessionFiles(found.project.id)).find(
			(f) => f.sessionId === sessionId,
		);
		if (!file) return { status: 'missing' };
		const messages = await this.sessionLogGateway.readConversation(file);
		if (!messages) return { status: 'missing' };
		return limit(messages);
	}
}

function limit(messages: readonly ConversationMessage[]): SessionConversationView {
	const recent = messages.slice(-MAX_CONVERSATION_MESSAGES);
	let truncated = recent.length < messages.length;
	const limited = recent.map((message) => {
		if (message.text.length <= MAX_MESSAGE_LENGTH) return message;
		truncated = true;
		return { ...message, text: `${message.text.slice(0, MAX_MESSAGE_LENGTH)}…` };
	});
	return { status: 'ok', messages: limited, truncated };
}
