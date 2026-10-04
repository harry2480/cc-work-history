import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type Database from 'better-sqlite3';
import { BrowserWindow, app, dialog, ipcMain, session } from 'electron';
import type { ImportResult } from './backend/application/usecases/import-session-logs.usecase';
import {
	openAppDatabase,
	resolveDatabasePath,
} from './backend/presentation/composition/database.composition';
import { registerIpcHandlers } from './backend/presentation/composition/ipc-handlers.composition';
import { resolveSessionLogRootDir } from './backend/presentation/composition/session-log.composition';
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

/**
 * ウィンドウの表示をブロックしないよう、起動後に非同期で取り込む。
 * 取り込み後にファイル監視を始め、変更があれば差分取り込みして renderer に通知する
 */
async function importAndWatchSessionLogs(db: Database.Database): Promise<void> {
	const publish = createSessionsChangedPublisher(() =>
		BrowserWindow.getAllWindows().map((window) => window.webContents),
	);
	const watch = createWatchSessionLogsUseCase(db, publish);
	watchSessionLogs = watch;
	// 取り込み中に追記されたファイルも取りこぼさないよう、先に監視を始める。
	// 届いた変更は、取り込みが終わってから差分取り込みする
	watch.start();
	try {
		// 起動時の取り込みも、ファイル監視・設定変更による取り込みと同じ順番待ちで実行する。
		// 取り込み前に開いた画面も最新になるよう、結果は通知される
		logImportResult('起動時', await watch.importAll());
	} catch (error) {
		console.error('[import] セッションログの取り込みに失敗しました', error);
	}
}

function logImportResult(trigger: string, result: ImportResult): void {
	console.info(`[import] セッションログを取り込みました（${trigger}）`, {
		scanned: result.scanned,
		imported: result.imported,
		unchanged: result.unchanged,
		empty: result.empty,
		failures: result.failures.length,
	});
	for (const failure of result.failures) {
		console.warn('[import] 取り込めなかったファイル', failure);
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

	// アプリの画面以外（外部のページ・新しいウィンドウ）は開かない
	window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
	window.webContents.on('will-navigate', (event, url) => {
		if (!isAppUrl(url)) event.preventDefault();
	});

	const devServerUrl = devRendererUrl();
	if (devServerUrl) {
		window.loadURL(devServerUrl);
	} else {
		window.loadFile(rendererIndexPath());
	}
}

/** dev では Vite の dev サーバー、build 後はバンドル済みの HTML を読み込む */
function devRendererUrl(): string | null {
	const url = process.env.ELECTRON_RENDERER_URL;
	return !app.isPackaged && url ? url : null;
}

function rendererIndexPath(): string {
	return join(__dirname, '../renderer/index.html');
}

/** アプリ自身の画面の URL か（IPC の呼び出し元の確認と、画面遷移の制限に使う） */
function isAppUrl(url: string): boolean {
	const devServerUrl = devRendererUrl();
	if (devServerUrl) {
		try {
			return new URL(url).origin === new URL(devServerUrl).origin;
		} catch {
			return false;
		}
	}
	return url.startsWith(pathToFileURL(rendererIndexPath()).href);
}

// 同じ DB を 2 つのプロセスで開かない（マイグレーションの二重適用などを防ぐ）
if (!app.requestSingleInstanceLock()) {
	console.info(
		'[app] すでに起動しているため終了します（同じデータの場所を使うアプリが動いています）',
	);
	app.quit();
} else {
	app.on('second-instance', () => {
		const [window] = BrowserWindow.getAllWindows();
		if (!window) return;
		if (window.isMinimized()) window.restore();
		window.focus();
	});
	app.whenReady().then(onReady);
}

function onReady(): void {
	try {
		database = openAppDatabase(app.getPath('userData'));
	} catch (error) {
		dialog.showErrorBox('データベースを開けませんでした', String(error));
		app.quit();
		return;
	}
	// カメラ・通知などの権限は使わないので、すべて断る
	session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
		callback(false),
	);
	registerIpcHandlers(ipcMain, database, {
		isTrustedSender: isAppUrl,
		paths: {
			logDirectory: resolveSessionLogRootDir(),
			databasePath: resolveDatabasePath(app.getPath('userData')),
		},
		importAll: async () => {
			if (!watchSessionLogs) throw new Error('取り込みの準備ができていません');
			const result = await watchSessionLogs.importAll();
			logImportResult('設定の変更', result);
			return result;
		},
	});
	createWindow();
	void importAndWatchSessionLogs(database);

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
}

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

let quitting = false;
app.on('will-quit', (event) => {
	if (quitting) return;
	// 監視を止めてから DB を閉じる（取り込み中なら、読み込み中のファイルが終わったところで打ち切る）
	event.preventDefault();
	quitting = true;
	void (async () => {
		try {
			await watchSessionLogs?.stop();
		} catch (error) {
			console.error('[quit] ファイル監視を止められませんでした', error);
		} finally {
			watchSessionLogs = null;
			database?.close();
			database = null;
			app.quit();
		}
	})();
});
