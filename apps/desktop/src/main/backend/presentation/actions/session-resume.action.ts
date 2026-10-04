import type { ResumeSessionResultDto } from '../../../../shared/ipc-contract';
import type { ResumeSessionUseCase } from '../../application/usecases/resume-session.usecase';
import { InvalidIpcRequestError } from '../loaders/timeline.loader';

const MAX_ID_LENGTH = 200;

/** ターミナルを開いてセッションを再開する */
export function resumeSession(
	useCase: ResumeSessionUseCase,
	request: unknown,
): Promise<ResumeSessionResultDto> {
	if (typeof request !== 'object' || request === null || Array.isArray(request)) {
		throw new InvalidIpcRequestError('リクエストが不正です');
	}
	const { id } = request as Record<string, unknown>;
	if (typeof id !== 'string' || !id.trim() || id.length > MAX_ID_LENGTH) {
		throw new InvalidIpcRequestError('セッション ID が不正です');
	}
	return useCase.execute(id);
}
