import type { UpdateIdleThresholdResultDto } from '../../../../shared/ipc-contract';
import type { UpdateIdleThresholdUseCase } from '../../application/usecases/update-idle-threshold.usecase';
import { InvalidIpcRequestError } from '../loaders/timeline.loader';

/** 活動区間を分ける無操作時間の閾値を変更する。範囲の検証はドメインで行う */
export function updateIdleThreshold(
	useCase: UpdateIdleThresholdUseCase,
	request: unknown,
): Promise<UpdateIdleThresholdResultDto> {
	if (typeof request !== 'object' || request === null || Array.isArray(request)) {
		throw new InvalidIpcRequestError('リクエストが不正です');
	}
	const { minutes } = request as Record<string, unknown>;
	if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
		throw new InvalidIpcRequestError('閾値が不正です');
	}
	return useCase.execute(minutes);
}
