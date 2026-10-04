import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import type { SessionConversationDto } from '@shared/ipc-contract';
import { useEffect, useState } from 'react';

type SessionConversationState = {
	data: SessionConversationDto | null;
	loading: boolean;
	error: string | null;
};

/** セッションの会話。ログを読むので、会話を開いたときにだけ使う */
export function useSessionConversation(sessionId: string): SessionConversationState {
	const [state, setState] = useState<SessionConversationState>({
		data: null,
		loading: true,
		error: null,
	});

	useEffect(() => {
		// 閉じたあと・セッションを切り替えたあとに届いた応答は捨てる
		let cancelled = false;
		setState({ data: null, loading: true, error: null });
		window.api.getSessionConversation({ id: sessionId }).then(
			(data) => {
				if (!cancelled) setState({ data, loading: false, error: null });
			},
			(error: unknown) => {
				if (!cancelled) setState({ data: null, loading: false, error: ipcErrorMessage(error) });
			},
		);
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	return state;
}
