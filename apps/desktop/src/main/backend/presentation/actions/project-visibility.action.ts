import type { UpdateProjectVisibilityUseCase } from '../../application/usecases/update-project-visibility.usecase';
import { InvalidIpcRequestError } from '../loaders/timeline.loader';

/** プロジェクト ID（ログのディレクトリ名）として明らかに長すぎるもの */
const MAX_PROJECT_ID_LENGTH = 1000;

/** プロジェクトを非表示にする・表示に戻す */
export function updateProjectVisibility(
	useCase: UpdateProjectVisibilityUseCase,
	request: unknown,
): void {
	if (typeof request !== 'object' || request === null || Array.isArray(request)) {
		throw new InvalidIpcRequestError('リクエストが不正です');
	}
	const { projectId, hidden } = request as Record<string, unknown>;
	if (typeof projectId !== 'string' || !projectId || projectId.length > MAX_PROJECT_ID_LENGTH) {
		throw new InvalidIpcRequestError('プロジェクト ID が不正です');
	}
	if (typeof hidden !== 'boolean') {
		throw new InvalidIpcRequestError('非表示の指定が不正です');
	}
	useCase.execute({ projectId, hidden });
}
