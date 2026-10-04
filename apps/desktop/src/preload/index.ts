import { type IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import { type DesktopApi, IPC_CHANNELS, type SessionsChangedPayload } from '../shared/ipc-contract';

// チャンネルを呼ぶだけ。ロジックは持たない
const api: DesktopApi = {
	ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
	onSessionsChanged: (listener) => {
		const handler = (_event: IpcRendererEvent, payload: SessionsChangedPayload) =>
			listener(payload);
		ipcRenderer.on(IPC_CHANNELS.sessionsChanged, handler);
		return () => {
			ipcRenderer.removeListener(IPC_CHANNELS.sessionsChanged, handler);
		};
	},
};

contextBridge.exposeInMainWorld('api', api);
