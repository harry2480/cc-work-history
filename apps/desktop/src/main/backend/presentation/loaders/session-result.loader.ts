import type { SessionResultDto } from '../../../../shared/ipc-contract';
import type { GetSessionResultUseCase } from '../../application/usecases/get-session-result.usecase';
import { InvalidIpcRequestError } from './timeline.loader';

const MAX_ID_LENGTH = 200;

/** セッションの成果（コミット数・変更ファイル数）を取得する。セッションが見つからなければ null */
export async function loadSessionResult(
	useCase: GetSessionResultUseCase,
	request: unknown,
	now: Date,
): Promise<SessionResultDto | null> {
	if (typeof request !== 'object' || request === null || Array.isArray(request)) {
		throw new InvalidIpcRequestError('リクエストが不正です');
	}
	const { id } = request as Record<string, unknown>;
	if (typeof id !== 'string' || !id.trim() || id.length > MAX_ID_LENGTH) {
		throw new InvalidIpcRequestError('セッション ID が不正です');
	}
	const result = await useCase.execute(id, now);
	if (!result) return null;
	return result.status === 'commits'
		? { ...result, computedAt: result.computedAt.toISOString() }
		: result;
}
