import { join } from 'node:path';
import { BrowserWindow, app, ipcMain } from 'electron';
import { IPC_CHANNELS, type PingResult } from '../shared/ipc-contract';

function registerIpcHandlers(): void {
	ipcMain.handle(
		IPC_CHANNELS.ping,
		(): PingResult => ({ message: 'pong', electronVersion: process.versions.electron }),
	);
}

function createWindow(): void {
	const window = new BrowserWindow({
		width: 1280,
		height: 800,
		show: false,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	window.once('ready-to-show', () => window.show());

	// dev では Vite の dev サーバー、build 後はバンドル済みの HTML を読み込む
	const devServerUrl = process.env.ELECTRON_RENDERER_URL;
	if (!app.isPackaged && devServerUrl) {
		window.loadURL(devServerUrl);
	} else {
		window.loadFile(join(__dirname, '../renderer/index.html'));
	}
}

app.whenReady().then(() => {
	registerIpcHandlers();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
