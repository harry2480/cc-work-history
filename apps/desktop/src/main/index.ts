import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { IPC_CHANNELS, type PingResult } from '../shared/ipc-contract';
import { openAppDatabase } from './backend/presentation/composition/database.composition';

// 開発時は本番と別の userData を使い、本番のデータを壊さない
if (!app.isPackaged) {
	app.setPath('userData', `${app.getPath('userData')}-dev`);
}

let database: Database.Database | null = null;

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
	try {
		database = openAppDatabase(app.getPath('userData'));
	} catch (error) {
		dialog.showErrorBox('データベースを開けませんでした', String(error));
		app.quit();
		return;
	}
	registerIpcHandlers();
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
	database?.close();
	database = null;
});
