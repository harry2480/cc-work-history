import type { Project } from '../models/project.model';
import type { Session } from '../models/session.model';

/** 期間の指定。`from` 以上 `to` 未満（半開区間） */
export type Period = {
	from: Date;
	to: Date;
};

/** 絞り込み条件。指定した条件はすべて満たすもの（AND）、各条件の中の候補はいずれか（OR） */
export type SessionFilter = {
	projectIds?: readonly string[];
	/** いずれかのタグが付いている（大文字小文字は区別しない） */
	tags?: readonly string[];
	/** 概要に含まれる文字列 */
	query?: string;
};

export type SessionWithProject = {
	session: Session;
	project: Project;
};

export interface SessionRepository {
	/** セッションとその活動区間を 1 トランザクションで追加または更新する。プロジェクトは保存済みであること */
	save(session: Session): void;
	findById(id: string): SessionWithProject | null;
	/**
	 * 期間に重なる活動区間を 1 つ以上持つセッションを、プロジェクトと一緒に開始時刻順で返す。
	 * セッションの活動区間はすべて含む（期間外のものも含む）
	 */
	findByPeriod(period: Period, filter?: SessionFilter): SessionWithProject[];
}
