import type { WebContents } from 'electron';
import { IPC_CHANNELS, type SessionsChangedPayload } from '../../../../shared/ipc-contract';
import type { SessionsChangedEvent } from '../../application/usecases/watch-session-logs.usecase';

/** セッションの変更を、開いているすべてのウィンドウの renderer に送る */
export function createSessionsChangedPublisher(
	getTargets: () => readonly WebContents[],
): (event: SessionsChangedEvent) => void {
	return (event) => {
		const payload: SessionsChangedPayload = {
			sessionIds: event.sessionIds,
			from: event.from.toISOString(),
			to: event.to.toISOString(),
		};
		for (const target of getTargets()) {
			if (!target.isDestroyed()) target.send(IPC_CHANNELS.sessionsChanged, payload);
		}
	};
}
