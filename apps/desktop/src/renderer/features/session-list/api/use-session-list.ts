import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { toFilterDto, useFilterStore } from '@/stores/filter-store';
import { useTimelineStore } from '@/stores/timeline-store';
import type { ListSessionsRequest, SessionListDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useState } from 'react';

type SessionListState = {
	data: SessionListDto | null;
	loading: boolean;
	error: string | null;
};

/** セッション一覧を取得する。絞り込み条件はフィルタバーと共通。セッションが更新されたら取り直す */
export function useSessionList(
	sort: ListSessionsRequest['sort'],
	page: number,
	pageSize: number,
): SessionListState {
	const [state, setState] = useState<SessionListState>({ data: null, loading: true, error: null });
	const dataVersion = useTimelineStore((s) => s.dataVersion);
	const projectIds = useFilterStore((s) => s.projectIds);
	const tags = useFilterStore((s) => s.tags);
	const query = useFilterStore((s) => s.query);
	const { key, direction } = sort;

	const load = useCallback(async () => {
		setState((prev) => ({ ...prev, loading: true }));
		try {
			const data = await window.api.listSessions({
				filter: toFilterDto({ projectIds, tags, query }),
				sort: { key, direction },
				page,
				pageSize,
			});
			setState({ data, loading: false, error: null });
		} catch (error) {
			setState({ data: null, loading: false, error: ipcErrorMessage(error) });
		}
	}, [projectIds, tags, query, key, direction, page, pageSize]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: dataVersion が変わったら取り直す
	useEffect(() => {
		void load();
	}, [load, dataVersion]);

	useEffect(() => window.api.onSessionsChanged(() => void load()), [load]);

	return state;
}
