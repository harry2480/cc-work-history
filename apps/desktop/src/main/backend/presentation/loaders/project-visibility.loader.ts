import type { ProjectVisibilityDto } from '../../../../shared/ipc-contract';
import type { GetProjectVisibilityUseCase } from '../../application/usecases/get-project-visibility.usecase';

/** すべてのプロジェクトと、非表示にしているかを取得する */
export function loadProjectVisibility(
	useCase: GetProjectVisibilityUseCase,
): ProjectVisibilityDto[] {
	return useCase.execute();
}
