import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { SessionAnnotationRepository } from '../../domain/repositories/session-annotation.repository';

export type FilterOptions = {
	/** 最終活動日時の新しい順 */
	projects: { id: string; name: string; path: string }[];
	/** 名前順 */
	tags: string[];
};

/** 絞り込みの選択肢（プロジェクトとタグの一覧）を取得する。非表示のプロジェクトは含めない */
export class GetFilterOptionsUseCase {
	constructor(
		private readonly projectRepository: ProjectRepository,
		private readonly sessionAnnotationRepository: SessionAnnotationRepository,
	) {}

	execute(): FilterOptions {
		const hiddenIds = new Set(this.projectRepository.findHiddenIds());
		return {
			projects: this.projectRepository
				.findAll()
				.filter((project) => !hiddenIds.has(project.id))
				.map((project) => ({ id: project.id, name: project.name, path: project.path })),
			tags: this.sessionAnnotationRepository.findAllTagNames(),
		};
	}
}
