import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { IPC_CHANNELS, type PingResult } from '../shared/ipc-contract';
import { openAppDatabase } from './backend/presentation/composition/database.composition';
import { createImportSessionLogsUseCase } from './backend/presentation/composition/import-session-logs.composition';

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

/** ウィンドウの表示をブロックしないよう、起動後に非同期で取り込む */
async function importSessionLogs(db: Database.Database): Promise<void> {
	try {
		const result = await createImportSessionLogsUseCase(db).execute();
		console.info('[import] セッションログを取り込みました', {
			scanned: result.scanned,
			imported: result.imported,
			unchanged: result.unchanged,
			empty: result.empty,
			failures: result.failures.length,
		});
		for (const failure of result.failures) {
			console.warn('[import] 取り込めなかったファイル', failure);
		}
	} catch (error) {
		console.error('[import] セッションログの取り込みに失敗しました', error);
	}
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
	void importSessionLogs(database);

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
