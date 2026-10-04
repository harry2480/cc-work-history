import { overlaps, weekPeriod } from '@/lib/utils/week';
import { toFilterDto, useFilterStore } from '@/stores/filter-store';
import { useTimelineStore } from '@/stores/timeline-store';
import type { TimelineDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useState } from 'react';

type TimelineState = {
	data: TimelineDto | null;
	loading: boolean;
	error: string | null;
};

/** 週のタイムラインを取得する。main からセッションの更新が届いたら、表示中の週に関係する場合だけ取り直す */
export function useTimeline(weekStart: Date): TimelineState {
	const [state, setState] = useState<TimelineState>({ data: null, loading: true, error: null });
	const weekStartTime = weekStart.getTime();
	const dataVersion = useTimelineStore((s) => s.dataVersion);
	const projectIds = useFilterStore((s) => s.projectIds);
	const tags = useFilterStore((s) => s.tags);
	const query = useFilterStore((s) => s.query);

	const load = useCallback(async () => {
		const { from, to } = weekPeriod(new Date(weekStartTime));
		setState((prev) => ({ ...prev, loading: true }));
		try {
			const data = await window.api.getTimeline({
				from: from.toISOString(),
				to: to.toISOString(),
				filter: toFilterDto({ projectIds, tags, query }),
			});
			setState({ data, loading: false, error: null });
		} catch (error) {
			setState({ data: null, loading: false, error: String(error) });
		}
	}, [weekStartTime, projectIds, tags, query]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: dataVersion が変わったら取り直す
	useEffect(() => {
		void load();
	}, [load, dataVersion]);

	useEffect(() => {
		const period = weekPeriod(new Date(weekStartTime));
		return window.api.onSessionsChanged((change) => {
			if (overlaps(period, { from: new Date(change.from), to: new Date(change.to) })) void load();
		});
	}, [load, weekStartTime]);

	return state;
}
