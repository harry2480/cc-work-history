import { contextBridge, ipcRenderer } from 'electron';
import { type DesktopApi, IPC_CHANNELS } from '../shared/ipc-contract';

// チャンネルを呼ぶだけ。ロジックは持たない
const api: DesktopApi = {
	ping: () => ipcRenderer.invoke(IPC_CHANNELS.ping),
};

contextBridge.exposeInMainWorld('api', api);
