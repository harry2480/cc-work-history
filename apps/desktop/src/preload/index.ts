import { type IpcRendererEvent, contextBridge, ipcRenderer } from 'electron';
import { type DesktopApi, IPC_CHANNELS, type SessionsChangedPayload } from '../shared/ipc-contract';

// チャンネルを呼ぶだけ。ロジックは持たない
const api: DesktopApi = {
	ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
	getTimeline: (request) => ipcRenderer.invoke(IPC_CHANNELS.getTimeline, request),
	getSessionDetail: (request) => ipcRenderer.invoke(IPC_CHANNELS.getSessionDetail, request),
	getFilterOptions: () => ipcRenderer.invoke(IPC_CHANNELS.getFilterOptions),
	getDashboard: (request) => ipcRenderer.invoke(IPC_CHANNELS.getDashboard, request),
	listSessions: (request) => ipcRenderer.invoke(IPC_CHANNELS.listSessions, request),
	updateSessionAnnotation: (request) =>
		ipcRenderer.invoke(IPC_CHANNELS.updateSessionAnnotation, request),
	getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
	updateIdleThreshold: (request) => ipcRenderer.invoke(IPC_CHANNELS.updateIdleThreshold, request),
	resumeSession: (request) => ipcRenderer.invoke(IPC_CHANNELS.resumeSession, request),
	getSessionResult: (request) => ipcRenderer.invoke(IPC_CHANNELS.getSessionResult, request),
	generateSessionSummary: (request) =>
		ipcRenderer.invoke(IPC_CHANNELS.generateSessionSummary, request),
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
