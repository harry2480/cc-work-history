import { DEFAULT_IDLE_THRESHOLD_MS, type SessionStatus } from '../../domain/models/session.model';
import type { SessionAnnotationRepository } from '../../domain/repositories/session-annotation.repository';
import type {
	SessionFilter,
	SessionRepository,
	SessionSortKey,
} from '../../domain/repositories/session.repository';

export type SessionListItem = {
	id: string;
	project: { id: string; name: string; path: string };
	startedAt: Date;
	endedAt: Date;
	activeDurationMs: number;
	status: SessionStatus;
	totalTokens: number;
	messageCount: number;
	summary: string | null;
	tags: string[];
};

export type ListSessionsInput = {
	filter?: SessionFilter;
	sort: { key: SessionSortKey; direction: 'asc' | 'desc' };
	/** 1 始まり */
	page: number;
	pageSize: number;
};

/** セッション一覧（期間を問わず、絞り込み・並び替え・ページ分け） */
export class ListSessionsUseCase {
	constructor(
		private readonly sessionRepository: SessionRepository,
		private readonly sessionAnnotationRepository: SessionAnnotationRepository,
		private readonly idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
	) {}

	execute(input: ListSessionsInput, now: Date): { items: SessionListItem[]; total: number } {
		const { items, total } = this.sessionRepository.search({
			filter: input.filter,
			sort: input.sort,
			offset: (input.page - 1) * input.pageSize,
			limit: input.pageSize,
		});
		const annotations = this.sessionAnnotationRepository.findBySessionIds(
			items.map(({ session }) => session.id),
		);
		return {
			total,
			items: items.map(({ session, project }) => ({
				id: session.id,
				project: { id: project.id, name: project.name, path: project.path },
				startedAt: session.startedAt,
				endedAt: session.endedAt,
				activeDurationMs: session.activeDurationMs,
				status: session.status(now, this.idleThresholdMs),
				totalTokens: session.totalTokens,
				messageCount: session.messageCount,
				summary: annotations.get(session.id)?.summary ?? null,
				tags: annotations.get(session.id)?.tagNames ?? [],
			})),
		};
	}
}
