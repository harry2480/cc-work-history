import type { Result } from './result.model';

export type ProjectError = 'EMPTY_ID' | 'EMPTY_PATH';

type ProjectProps = {
	/** `~/.claude/projects/` 配下のディレクトリ名 */
	id: string;
	/** プロジェクトの作業ディレクトリ */
	path: string;
	lastActivityAt: Date;
};

export class Project {
	private constructor(
		readonly id: string,
		readonly path: string,
		readonly lastActivityAt: Date,
	) {}

	static create(props: ProjectProps): Result<Project, ProjectError> {
		const id = props.id.trim();
		const path = props.path.trim();
		if (!id) return { success: false, error: 'EMPTY_ID' };
		if (!path) return { success: false, error: 'EMPTY_PATH' };
		return { success: true, value: new Project(id, path, props.lastActivityAt) };
	}

	/** 表示名。作業ディレクトリの末尾のフォルダ名 */
	get name(): string {
		const segments = this.path.split(/[\\/]/).filter(Boolean);
		return segments.at(-1) ?? this.path;
	}

	/** より新しい活動日時で更新したプロジェクトを返す（古い日時なら変更しない） */
	touch(activityAt: Date): Project {
		if (activityAt <= this.lastActivityAt) return this;
		return new Project(this.id, this.path, activityAt);
	}
}
