import { DEFAULT_IDLE_THRESHOLD_MS, type SessionStatus } from '../../domain/models/session.model';
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
	activities: TimelineActivity[];
};

/** セッションの詳細を取得する。見つからなければ null */
export class GetSessionDetailUseCase {
	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
	) {}

	execute(id: string, now: Date): SessionDetail | null {
		const found = this.sessionRepository.findById(id);
		if (!found) return null;
		const { session, project } = found;
		return {
			id: session.id,
			project: { id: project.id, name: project.name, path: project.path },
			cwd: session.cwd,
			startedAt: session.startedAt,
			endedAt: session.endedAt,
			activeDurationMs: session.activeDurationMs,
			status: session.status(now, this.idleThresholdMs),
			inputTokens: session.inputTokens,
			outputTokens: session.outputTokens,
			totalTokens: session.totalTokens,
			messageCount: session.messageCount,
			models: [...session.models],
			activities: session.activities.map((a) => ({
				startedAt: a.startedAt,
				endedAt: a.endedAt,
				messageCount: a.messageCount,
			})),
		};
	}
}
