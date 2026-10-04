import type {
	ActivityDto,
	FilterOptionsDto,
	SessionDetailDto,
	TimelineDto,
} from '../../../../shared/ipc-contract';
import type { GetFilterOptionsUseCase } from '../../application/usecases/get-filter-options.usecase';
import type { GetSessionDetailUseCase } from '../../application/usecases/get-session-detail.usecase';
import type {
	GetTimelineUseCase,
	TimelineActivity,
} from '../../application/usecases/get-timeline.usecase';

/** タイムラインで一度に取得できる期間の上限（夏時間が終わる月は 1 時間長くなるので、その分を足す） */
const MAX_PERIOD_MS = 31 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000;
const MAX_ID_LENGTH = 200;
const MAX_FILTER_VALUES = 100;
const MAX_FILTER_VALUE_LENGTH = 200;

/** renderer から受け取った値が不正なときのエラー */
export class InvalidIpcRequestError extends Error {
	override name = 'InvalidIpcRequestError';
}

/** 期間（週）のタイムラインを取得する */
export function loadTimeline(
	useCase: GetTimelineUseCase,
	request: unknown,
	now: Date,
): TimelineDto {
	const { from, to, filter } = parseTimelineRequest(request);
	return {
		from: from.toISOString(),
		to: to.toISOString(),
		sessions: useCase.execute({ from, to }, now, filter).map((item) => ({
			id: item.id,
			project: item.project,
			startedAt: item.startedAt.toISOString(),
			endedAt: item.endedAt.toISOString(),
			status: item.status,
			totalTokens: item.totalTokens,
			messageCount: item.messageCount,
			summary: item.summary,
			tags: item.tags,
			activities: item.activities.map(toActivityDto),
		})),
	};
}

/** セッションの詳細を取得する。見つからなければ null */
export function loadSessionDetail(
	useCase: GetSessionDetailUseCase,
	request: unknown,
	now: Date,
): SessionDetailDto | null {
	const id = parseSessionId(request);
	const detail = useCase.execute(id, now);
	if (!detail) return null;
	return {
		...detail,
		startedAt: detail.startedAt.toISOString(),
		endedAt: detail.endedAt.toISOString(),
		activities: detail.activities.map(toActivityDto),
	};
}

function toActivityDto(activity: TimelineActivity): ActivityDto {
	return {
		startedAt: activity.startedAt.toISOString(),
		endedAt: activity.endedAt.toISOString(),
		messageCount: activity.messageCount,
	};
}

/** 絞り込みの選択肢を取得する */
export function loadFilterOptions(useCase: GetFilterOptionsUseCase): FilterOptionsDto {
	return useCase.execute();
}

export type TimelineFilter = { projectIds?: string[]; tags?: string[]; query?: string };

function parseTimelineRequest(request: unknown): { from: Date; to: Date; filter: TimelineFilter } {
	const { from, to } = parsePeriodRequest(request);
	return { from, to, filter: parseFilter((request as Record<string, unknown>).filter) };
}

/** `{ from, to }`（ISO 8601、from < to、最大 31 日）を検証する */
export function parsePeriodRequest(request: unknown): { from: Date; to: Date } {
	if (!isObject(request)) throw new InvalidIpcRequestError('期間を指定してください');
	const from = parseDate(request.from, 'from');
	const to = parseDate(request.to, 'to');
	if (from >= to) throw new InvalidIpcRequestError('from は to より前にしてください');
	if (to.getTime() - from.getTime() > MAX_PERIOD_MS) {
		throw new InvalidIpcRequestError('期間は 31 日以内にしてください');
	}
	return { from, to };
}

export function parseFilter(value: unknown): TimelineFilter {
	if (value === undefined) return {};
	if (!isObject(value)) throw new InvalidIpcRequestError('絞り込み条件が不正です');
	const filter: TimelineFilter = {};
	if (value.projectIds !== undefined)
		filter.projectIds = parseStringList(value.projectIds, 'projectIds');
	if (value.tags !== undefined) filter.tags = parseStringList(value.tags, 'tags');
	if (value.query !== undefined) {
		if (typeof value.query !== 'string' || value.query.length > MAX_FILTER_VALUE_LENGTH) {
			throw new InvalidIpcRequestError('検索キーワードが不正です');
		}
		filter.query = value.query;
	}
	return filter;
}

function parseStringList(value: unknown, name: string): string[] {
	if (
		!Array.isArray(value) ||
		value.length > MAX_FILTER_VALUES ||
		value.some((v) => typeof v !== 'string' || v.length > MAX_FILTER_VALUE_LENGTH)
	) {
		throw new InvalidIpcRequestError(`${name} が不正です`);
	}
	return value as string[];
}

function parseSessionId(request: unknown): string {
	const id = isObject(request) ? request.id : undefined;
	if (typeof id !== 'string' || !id.trim() || id.length > MAX_ID_LENGTH) {
		throw new InvalidIpcRequestError('セッション ID が不正です');
	}
	return id;
}

function parseDate(value: unknown, name: string): Date {
	const date = typeof value === 'string' ? new Date(value) : null;
	if (!date || Number.isNaN(date.getTime())) {
		throw new InvalidIpcRequestError(`${name} は ISO 8601 形式の日時にしてください`);
	}
	return date;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
