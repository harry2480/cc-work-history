import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { useTimelineStore } from '@/stores/timeline-store';
import type { DashboardDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useState } from 'react';
import type { DashboardPeriod } from '../utils/period';

type DashboardState = {
	data: DashboardDto | null;
	loading: boolean;
	error: string | null;
};

/** 期間の統計を取得する。セッションが更新されたら取り直す */
export function useDashboard(period: DashboardPeriod): DashboardState {
	const [state, setState] = useState<DashboardState>({ data: null, loading: true, error: null });
	const dataVersion = useTimelineStore((s) => s.dataVersion);
	const from = period.from.getTime();
	const to = period.to.getTime();

	const load = useCallback(async () => {
		setState((prev) => ({ ...prev, loading: true }));
		try {
			const data = await window.api.getDashboard({
				from: new Date(from).toISOString(),
				to: new Date(to).toISOString(),
			});
			setState({ data, loading: false, error: null });
		} catch (error) {
			setState({ data: null, loading: false, error: ipcErrorMessage(error) });
		}
	}, [from, to]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: dataVersion が変わったら取り直す
	useEffect(() => {
		void load();
	}, [load, dataVersion]);

	useEffect(() => window.api.onSessionsChanged(() => void load()), [load]);

	return state;
}
