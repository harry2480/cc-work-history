import type { GenerateSummaryResultDto } from '../../../../shared/ipc-contract';
import type { GenerateSessionSummaryUseCase } from '../../application/usecases/generate-session-summary.usecase';
import { InvalidIpcRequestError } from '../loaders/timeline.loader';

const MAX_ID_LENGTH = 200;

/** セッションの概要とタグを Claude CLI で生成して保存する */
export function generateSessionSummary(
	useCase: GenerateSessionSummaryUseCase,
	request: unknown,
): Promise<GenerateSummaryResultDto> {
	if (typeof request !== 'object' || request === null || Array.isArray(request)) {
		throw new InvalidIpcRequestError('リクエストが不正です');
	}
	const { id } = request as Record<string, unknown>;
	if (typeof id !== 'string' || !id.trim() || id.length > MAX_ID_LENGTH) {
		throw new InvalidIpcRequestError('セッション ID が不正です');
	}
	return useCase.execute(id);
}
