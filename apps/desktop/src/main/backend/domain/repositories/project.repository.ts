import type { Project } from '../models/project.model';

export interface ProjectRepository {
	/** 追加または更新する */
	save(project: Project): void;
	findById(id: string): Project | null;
	/** 最終活動日時の新しい順（非表示のプロジェクトも含む） */
	findAll(): Project[];
	/** 非表示にしたプロジェクトの ID */
	findHiddenIds(): string[];
	/** 非表示にする・表示に戻す。プロジェクトが見つからなければ false */
	setHidden(projectId: string, hidden: boolean): boolean;
}
