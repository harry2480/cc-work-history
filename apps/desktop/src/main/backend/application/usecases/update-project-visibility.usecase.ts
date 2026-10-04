import type { ProjectRepository } from '../../domain/repositories/project.repository';

/** 対象のプロジェクトが見つからないときのエラー */
export class ProjectNotFoundError extends Error {
	override name = 'ProjectNotFoundError';
}

/**
 * プロジェクトを非表示にする・表示に戻す。
 * 非表示のプロジェクトはタイムライン・一覧・ダッシュボード・絞り込みの選択肢に出さない（取り込みは続ける）
 */
export class UpdateProjectVisibilityUseCase {
	constructor(private readonly projectRepository: ProjectRepository) {}

	execute(input: { projectId: string; hidden: boolean }): void {
		if (!this.projectRepository.setHidden(input.projectId, input.hidden)) {
			throw new ProjectNotFoundError(`プロジェクトが見つかりません: ${input.projectId}`);
		}
	}
}
