import type { ProjectRepository } from '../../domain/repositories/project.repository';
import type { SessionAnnotationRepository } from '../../domain/repositories/session-annotation.repository';

export type FilterOptions = {
	/** 最終活動日時の新しい順 */
	projects: { id: string; name: string; path: string }[];
	/** 名前順 */
	tags: string[];
};

/** 絞り込みの選択肢（プロジェクトとタグの一覧）を取得する */
export class GetFilterOptionsUseCase {
	constructor(
		private readonly projectRepository: ProjectRepository,
		private readonly sessionAnnotationRepository: SessionAnnotationRepository,
	) {}

	execute(): FilterOptions {
		return {
			projects: this.projectRepository
				.findAll()
				.map((project) => ({ id: project.id, name: project.name, path: project.path })),
			tags: this.sessionAnnotationRepository.findAllTagNames(),
		};
	}
}
