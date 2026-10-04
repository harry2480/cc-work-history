import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { useTimelineStore } from '@/stores/timeline-store';
import type { SessionDetailDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useRef, useState } from 'react';

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

	// 古い応答が後から届いても、最新の表示を上書きしないようにする
	const latestRequest = useRef(0);

	const load = useCallback(async () => {
		const request = ++latestRequest.current;
		if (!sessionId) {
			setState({ data: null, loading: false, error: null });
			return;
		}
		// 別のセッションに切り替えたら、読み込み中に前のセッションの詳細を見せない（操作もさせない）
		setState((prev) => ({
			data: prev.data?.id === sessionId ? prev.data : null,
			loading: true,
			error: null,
		}));
		try {
			const data = await window.api.getSessionDetail({ id: sessionId });
			if (request === latestRequest.current) setState({ data, loading: false, error: null });
		} catch (error) {
			if (request === latestRequest.current) {
				setState({ data: null, loading: false, error: ipcErrorMessage(error) });
			}
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
