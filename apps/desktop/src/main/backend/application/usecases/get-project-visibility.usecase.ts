import type { ProjectRepository } from '../../domain/repositories/project.repository';

export type ProjectVisibility = {
	id: string;
	name: string;
	path: string;
	hidden: boolean;
};

/** すべてのプロジェクトと、非表示にしているかを取得する（設定画面用。最終活動日時の新しい順） */
export class GetProjectVisibilityUseCase {
	constructor(private readonly projectRepository: ProjectRepository) {}

	execute(): ProjectVisibility[] {
		const hiddenIds = new Set(this.projectRepository.findHiddenIds());
		return this.projectRepository.findAll().map((project) => ({
			id: project.id,
			name: project.name,
			path: project.path,
			hidden: hiddenIds.has(project.id),
		}));
	}
}
