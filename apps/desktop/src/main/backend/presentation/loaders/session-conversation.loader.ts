import type { SessionConversationDto } from '../../../../shared/ipc-contract';
import type { GetSessionConversationUseCase } from '../../application/usecases/get-session-conversation.usecase';
import { InvalidIpcRequestError } from './timeline.loader';

const MAX_ID_LENGTH = 200;

/** セッションの会話を取得する。セッションが見つからなければ null */
export function loadSessionConversation(
	useCase: GetSessionConversationUseCase,
	request: unknown,
): Promise<SessionConversationDto | null> {
	if (typeof request !== 'object' || request === null || Array.isArray(request)) {
		throw new InvalidIpcRequestError('リクエストが不正です');
	}
	const { id } = request as Record<string, unknown>;
	if (typeof id !== 'string' || !id.trim() || id.length > MAX_ID_LENGTH) {
		throw new InvalidIpcRequestError('セッション ID が不正です');
	}
	return useCase.execute(id);
}
