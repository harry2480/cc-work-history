import type { TagSource } from '../../domain/models/session-annotation.model';
import { DEFAULT_IDLE_THRESHOLD_MS, type SessionStatus } from '../../domain/models/session.model';
import type { TodoStatus } from '../../domain/models/todo-list.model';
import type { SessionAnnotationRepository } from '../../domain/repositories/session-annotation.repository';
import type { SessionRepository } from '../../domain/repositories/session.repository';
import type { TimelineActivity } from './get-timeline.usecase';

export type SessionDetail = {
	id: string;
	project: { id: string; name: string; path: string };
	cwd: string | null;
	startedAt: Date;
	endedAt: Date;
	/** 活動区間の合計（放置時間を含まない） */
	activeDurationMs: number;
	status: SessionStatus;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	messageCount: number;
	models: string[];
	summary: string | null;
	/** 概要をユーザーが手動で編集したか */
	summaryEditedManually: boolean;
	tags: { name: string; source: TagSource }[];
	activities: TimelineActivity[];
	/** 作業状況チェックリスト（ログ中の TodoWrite / Task 系ツールの最終状態。読み取り専用） */
	todos: { content: string; status: TodoStatus }[];
};

/** セッションの詳細を取得する。見つからなければ null */
export class GetSessionDetailUseCase {
	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly sessionAnnotationRepository: SessionAnnotationRepository,
		/** 進行中かどうかの判定に使う閾値。設定の変更を反映するため、取得のたびに読む */
		private readonly idleThresholdMs: () => number = () => DEFAULT_IDLE_THRESHOLD_MS,
	) {}

	execute(id: string, now: Date): SessionDetail | null {
		const found = this.sessionRepository.findById(id);
		if (!found) return null;
		const { session, project } = found;
		const annotation = this.sessionAnnotationRepository.findBySessionId(id);
		return {
			id: session.id,
			project: { id: project.id, name: project.name, path: project.path },
			cwd: session.cwd,
			startedAt: session.startedAt,
			endedAt: session.endedAt,
			activeDurationMs: session.activeDurationMs,
			status: session.status(now, this.idleThresholdMs()),
			inputTokens: session.inputTokens,
			outputTokens: session.outputTokens,
			totalTokens: session.totalTokens,
			messageCount: session.messageCount,
			models: [...session.models],
			summary: annotation?.summary ?? null,
			summaryEditedManually: annotation?.summaryEditedManually ?? false,
			tags: (annotation?.tags ?? []).map(({ tag, source }) => ({ name: tag.name, source })),
			activities: session.activities.map((a) => ({
				startedAt: a.startedAt,
				endedAt: a.endedAt,
				messageCount: a.messageCount,
			})),
			todos: session.todos.items.map(({ content, status }) => ({ content, status })),
		};
	}
}
