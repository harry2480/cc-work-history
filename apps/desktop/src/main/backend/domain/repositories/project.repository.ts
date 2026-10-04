import type { Project } from '../models/project.model';

export interface ProjectRepository {
	/** 追加または更新する */
	save(project: Project): void;
	findById(id: string): Project | null;
	/** 最終活動日時の新しい順 */
	findAll(): Project[];
}
