import { useTimelineStore } from '@/stores/timeline-store';
import type { SessionDetailDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useState } from 'react';

type SessionDetailState = {
	data: SessionDetailDto | null;
	loading: boolean;
	error: string | null;
};

/** 選択中のセッションの詳細を取得する。そのセッションの更新通知が届いたら取り直す */
export function useSessionDetail(sessionId: string | null): SessionDetailState {
	const [state, setState] = useState<SessionDetailState>({
		data: null,
		loading: false,
		error: null,
	});
	const dataVersion = useTimelineStore((s) => s.dataVersion);

	const load = useCallback(async () => {
		if (!sessionId) {
			setState({ data: null, loading: false, error: null });
			return;
		}
		setState((prev) => ({ ...prev, loading: true }));
		try {
			const data = await window.api.getSessionDetail({ id: sessionId });
			setState({ data, loading: false, error: null });
		} catch (error) {
			setState({ data: null, loading: false, error: String(error) });
		}
	}, [sessionId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: dataVersion が変わったら取り直す
	useEffect(() => {
		void load();
	}, [load, dataVersion]);

	useEffect(() => {
		if (!sessionId) return;
		return window.api.onSessionsChanged((change) => {
			if (change.sessionIds.includes(sessionId)) void load();
		});
	}, [load, sessionId]);

	return state;
}
