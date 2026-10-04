import type { SessionListDto, SessionSortKeyDto } from '../../../../shared/ipc-contract';
import type { ListSessionsUseCase } from '../../application/usecases/list-sessions.usecase';
import { InvalidIpcRequestError, parseFilter } from './timeline.loader';

const SORT_KEYS: readonly SessionSortKeyDto[] = [
	'startedAt',
	'project',
	'activeDuration',
	'totalTokens',
];
const MAX_PAGE_SIZE = 200;

/** セッション一覧（絞り込み・並び替え・ページ分け）を取得する */
export function loadSessionList(
	useCase: ListSessionsUseCase,
	request: unknown,
	now: Date,
): SessionListDto {
	if (typeof request !== 'object' || request === null || Array.isArray(request)) {
		throw new InvalidIpcRequestError('リクエストが不正です');
	}
	const { filter, sort, page, pageSize } = request as Record<string, unknown>;
	const sortValue = sort as { key?: unknown; direction?: unknown } | undefined;
	if (
		!sortValue ||
		!SORT_KEYS.includes(sortValue.key as SessionSortKeyDto) ||
		(sortValue.direction !== 'asc' && sortValue.direction !== 'desc')
	) {
		throw new InvalidIpcRequestError('並び替えの指定が不正です');
	}
	if (!Number.isInteger(page) || (page as number) < 1) {
		throw new InvalidIpcRequestError('ページの指定が不正です');
	}
	if (
		!Number.isInteger(pageSize) ||
		(pageSize as number) < 1 ||
		(pageSize as number) > MAX_PAGE_SIZE
	) {
		throw new InvalidIpcRequestError('1 ページの件数が不正です');
	}

	const result = useCase.execute(
		{
			filter: parseFilter(filter),
			sort: { key: sortValue.key as SessionSortKeyDto, direction: sortValue.direction },
			page: page as number,
			pageSize: pageSize as number,
		},
		now,
	);
	return {
		total: result.total,
		page: page as number,
		pageSize: pageSize as number,
		items: result.items.map((item) => ({
			...item,
			startedAt: item.startedAt.toISOString(),
			endedAt: item.endedAt.toISOString(),
		})),
	};
}
