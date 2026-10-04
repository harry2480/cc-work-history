import { DEFAULT_IDLE_THRESHOLD_MS, type SessionStatus } from '../../domain/models/session.model';
import type { Period, SessionRepository } from '../../domain/repositories/session.repository';

export type TimelineActivity = {
	startedAt: Date;
	endedAt: Date;
	messageCount: number;
};

export type TimelineItem = {
	id: string;
	project: { id: string; name: string; path: string };
	startedAt: Date;
	endedAt: Date;
	status: SessionStatus;
	totalTokens: number;
	messageCount: number;
	/** 期間に重なる活動区間だけ */
	activities: TimelineActivity[];
};

/** タイムラインに表示する、期間に重なるセッションと活動区間を取得する */
export class GetTimelineUseCase {
	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
	) {}

	execute(period: Period, now: Date): TimelineItem[] {
		return this.sessionRepository.findByPeriod(period).map(({ session, project }) => ({
			id: session.id,
			project: { id: project.id, name: project.name, path: project.path },
			startedAt: session.startedAt,
			endedAt: session.endedAt,
			status: session.status(now, this.idleThresholdMs),
			totalTokens: session.totalTokens,
			messageCount: session.messageCount,
			activities: session.activities
				.filter((a) => a.startedAt < period.to && a.endedAt >= period.from)
				.map((a) => ({ startedAt: a.startedAt, endedAt: a.endedAt, messageCount: a.messageCount })),
		}));
	}
}
