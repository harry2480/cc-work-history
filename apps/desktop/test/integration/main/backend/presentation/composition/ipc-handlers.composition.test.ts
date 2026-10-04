import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { registerIpcHandlers } from '../../../../../../src/main/backend/presentation/composition/ipc-handlers.composition';
import { IPC_CHANNELS } from '../../../../../../src/shared/ipc-contract';

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown;

let dir: string;
let db: Database.Database;
let handlers: Map<string, Handler>;

const APP_URL = 'file:///app/renderer/index.html';

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	handlers = new Map();
	const ipcMain = {
		handle: (channel: string, listener: Handler) => handlers.set(channel, listener),
	} as unknown as IpcMain;
	registerIpcHandlers(ipcMain, db, {
		isTrustedSender: (url) => url === APP_URL,
		paths: { logDirectory: '/logs', databasePath: '/data/app.db' },
		importAll: async () => {
			throw new Error('not used');
		},
	});
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

const eventFrom = (url: string | null) =>
	({ senderFrame: url === null ? null : { url } }) as unknown as IpcMainInvokeEvent;

describe('registerIpcHandlers', () => {
	it('アプリ自身の画面からの呼び出しは処理する', async () => {
		const ping = handlers.get(IPC_CHANNELS.ping);

		expect(await ping?.(eventFrom(APP_URL))).toMatchObject({ message: 'pong' });
	});

	it.each([['https://example.com/'], ['file:///other/index.html'], [null]])(
		'それ以外（%s）からの呼び出しは断る',
		async (url) => {
			for (const [channel, handler] of handlers) {
				await expect(
					Promise.resolve().then(() => handler(eventFrom(url), {})),
					channel,
				).rejects.toThrow('許可されていない呼び出し元');
			}
		},
	);
});
