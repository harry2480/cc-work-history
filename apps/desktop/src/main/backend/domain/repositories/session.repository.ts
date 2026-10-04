import type { Project } from '../models/project.model';
import type { Session } from '../models/session.model';

/** 期間の指定。`from` 以上 `to` 未満（半開区間） */
export type Period = {
	from: Date;
	to: Date;
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
	findByPeriod(period: Period): SessionWithProject[];
}
