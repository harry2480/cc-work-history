import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { BrowserWindow, app, dialog, ipcMain } from 'electron';
import { IPC_CHANNELS, type PingResult } from '../shared/ipc-contract';
import { openAppDatabase } from './backend/presentation/composition/database.composition';
import { createImportSessionLogsUseCase } from './backend/presentation/composition/import-session-logs.composition';
import { createWatchSessionLogsUseCase } from './backend/presentation/composition/watch-session-logs.composition';
import { createSessionsChangedPublisher } from './backend/presentation/events/sessions-changed.event';

// 開発時は本番と別の userData を使い、本番のデータを壊さない。
// 動作確認や E2E では CC_WORK_HISTORY_USER_DATA_DIR で一時ディレクトリに向けられる
if (process.env.CC_WORK_HISTORY_USER_DATA_DIR) {
	app.setPath('userData', process.env.CC_WORK_HISTORY_USER_DATA_DIR);
} else if (!app.isPackaged) {
	app.setPath('userData', `${app.getPath('userData')}-dev`);
}

let database: Database.Database | null = null;
let watchSessionLogs: ReturnType<typeof createWatchSessionLogsUseCase> | null = null;

function registerIpcHandlers(): void {
	ipcMain.handle(
		IPC_CHANNELS.ping,
		(): PingResult => ({ message: 'pong', electronVersion: process.versions.electron }),
	);
}

/**
 * ウィンドウの表示をブロックしないよう、起動後に非同期で取り込む。
 * 取り込み後にファイル監視を始め、変更があれば差分取り込みして renderer に通知する
 */
async function importAndWatchSessionLogs(db: Database.Database): Promise<void> {
	const publish = createSessionsChangedPublisher(() =>
		BrowserWindow.getAllWindows().map((window) => window.webContents),
	);
	watchSessionLogs = createWatchSessionLogsUseCase(db, publish);
	try {
		const result = await createImportSessionLogsUseCase(db).execute();
		// 取り込み前に開いた画面も最新にするため、起動時の取り込み結果も通知する
		watchSessionLogs.publish(result);
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
	watchSessionLogs.start();
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
	void importAndWatchSessionLogs(database);

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

let quitting = false;
app.on('will-quit', (event) => {
	if (quitting) return;
	// 監視を止めてから DB を閉じる（取り込み中なら完了を待つ）
	event.preventDefault();
	quitting = true;
	void (async () => {
		await watchSessionLogs?.stop();
		watchSessionLogs = null;
		database?.close();
		database = null;
		app.quit();
	})();
});
