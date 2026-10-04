import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import type { SessionResultDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useRef, useState } from 'react';

type SessionResultState = {
	data: SessionResultDto | null;
	loading: boolean;
	error: string | null;
};

/** セッションの成果（コミット数・変更ファイル数）。そのセッションの更新通知が届いたら取り直す */
export function useSessionResult(sessionId: string): SessionResultState {
	const [state, setState] = useState<SessionResultState>({
		data: null,
		loading: true,
		error: null,
	});

	// 古い応答が後から届いても、最新の表示を上書きしないようにする
	const latestRequest = useRef(0);

	const load = useCallback(async () => {
		const request = ++latestRequest.current;
		setState((prev) => ({ ...prev, loading: true }));
		try {
			const data = await window.api.getSessionResult({ id: sessionId });
			if (request === latestRequest.current) setState({ data, loading: false, error: null });
		} catch (error) {
			if (request === latestRequest.current) {
				setState({ data: null, loading: false, error: ipcErrorMessage(error) });
			}
		}
	}, [sessionId]);

	useEffect(() => {
		void load();
		// 閉じたあとに届いた応答は捨てる
		return () => {
			latestRequest.current++;
		};
	}, [load]);

	useEffect(
		() =>
			window.api.onSessionsChanged((change) => {
				if (change.sessionIds.includes(sessionId)) void load();
			}),
		[load, sessionId],
	);

	return state;
}
