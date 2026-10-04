import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GetAppSettingsUseCase } from '../../../../../../src/main/backend/application/usecases/get-app-settings.usecase';
import { UpdateIdleThresholdUseCase } from '../../../../../../src/main/backend/application/usecases/update-idle-threshold.usecase';
import {
	type SessionsChangedEvent,
	WatchSessionLogsUseCase,
} from '../../../../../../src/main/backend/application/usecases/watch-session-logs.usecase';
import { AppSettings } from '../../../../../../src/main/backend/domain/models/app-settings.model';
import { StubLogWatcherAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-log-watcher.adapter';
import { migrationFiles } from '../../../../../../src/main/backend/infrastructure/db/migrations';
import { openSqliteDatabase } from '../../../../../../src/main/backend/infrastructure/db/sqlite-connection';
import { SqliteMigrator } from '../../../../../../src/main/backend/infrastructure/db/sqlite-migrator';
import { SqliteAppSettingsRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-app-settings.repository';
import { SqliteSessionRepository } from '../../../../../../src/main/backend/infrastructure/repositories/sqlite-session.repository';
import { updateIdleThreshold } from '../../../../../../src/main/backend/presentation/actions/settings.action';
import { createImportSessionLogsUseCase } from '../../../../../../src/main/backend/presentation/composition/import-session-logs.composition';
import { loadSettings } from '../../../../../../src/main/backend/presentation/loaders/settings.loader';
import { InvalidIpcRequestError } from '../../../../../../src/main/backend/presentation/loaders/timeline.loader';

const fixtures = resolve(__dirname, '../../../../../fixtures/claude-projects');
/** フィクスチャのセッション。09:00:12 から 09:40 まで約 40 分あいている */
const SESSION_ID = '11111111-1111-4111-8111-111111111111';

let dir: string;
let db: Database.Database;
let settings: SqliteAppSettingsRepository;
let events: SessionsChangedEvent[];
let watch: WatchSessionLogsUseCase;

const activityCount = () =>
	new SqliteSessionRepository(db).findById(SESSION_ID)?.session.activities.length;

beforeEach(async () => {
	dir = mkdtempSync(join(tmpdir(), 'cc-work-history-test-'));
	const logDir = join(dir, 'projects');
	cpSync(fixtures, logDir, { recursive: true });
	db = openSqliteDatabase(join(dir, 'test.db'));
	SqliteMigrator.fromFiles(migrationFiles).migrate(db);
	settings = new SqliteAppSettingsRepository(db);
	events = [];
	const env = { CC_WORK_HISTORY_LOG_DIR: logDir };
	watch = new WatchSessionLogsUseCase(
		new StubLogWatcherAdapter(),
		createImportSessionLogsUseCase(db, env),
		(event) => events.push(event),
	);
	await createImportSessionLogsUseCase(db, env).execute();
});

afterEach(() => {
	db.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('SqliteAppSettingsRepository', () => {
	it('未保存なら既定値、保存したら保存した値を返す', () => {
		expect(settings.get().idleThresholdMinutes).toBe(30);

		const next = AppSettings.create({ idleThresholdMinutes: 45 });
		if (!next.success) throw new Error(next.error);
		settings.save(next.value);
		settings.save(next.value);

		expect(new SqliteAppSettingsRepository(db).get().idleThresholdMinutes).toBe(45);
	});

	it('壊れた値が保存されていたら既定値にする', () => {
		db.prepare(
			"INSERT INTO app_settings (key, value) VALUES ('idle_threshold_minutes', '\"x')",
		).run();

		expect(settings.get().idleThresholdMinutes).toBe(30);
	});
});

describe('設定の取得と閾値の変更（実ファイル + SQLite）', () => {
	it('データの場所と、閾値と指定できる範囲を返す', () => {
		expect(
			loadSettings(new GetAppSettingsUseCase(settings), {
				logDirectory: '/logs',
				databasePath: '/data/app.db',
			}),
		).toEqual({
			logDirectory: '/logs',
			databasePath: '/data/app.db',
			idleThresholdMinutes: 30,
			defaultIdleThresholdMinutes: 30,
			minIdleThresholdMinutes: 1,
			maxIdleThresholdMinutes: 240,
		});
	});

	it('閾値を変えると保存し、活動区間を計算し直して通知する', async () => {
		expect(activityCount()).toBe(2);
		const useCase = new UpdateIdleThresholdUseCase(settings, watch);

		expect(await updateIdleThreshold(useCase, { minutes: 60 })).toEqual({ failedFiles: 0 });

		expect(settings.get().idleThresholdMinutes).toBe(60);
		expect(activityCount()).toBe(1);
		expect(events.at(-1)?.sessionIds).toContain(SESSION_ID);

		await updateIdleThreshold(useCase, { minutes: 30 });
		expect(activityCount()).toBe(2);
	});

	it('再計算が途中で終わっても、次の取り込みで新しい閾値で計算し直す', async () => {
		const next = AppSettings.create({ idleThresholdMinutes: 60 });
		if (!next.success) throw new Error(next.error);
		// 閾値の保存後、取り込む前に終了した状態を再現する
		settings.save(next.value);
		expect(activityCount()).toBe(2);

		await watch.importAll();

		expect(activityCount()).toBe(1);
	});

	it.each([null, [], { minutes: '10' }, { minutes: Number.NaN }, {}])(
		'不正なリクエスト %j は弾く',
		(request) => {
			const useCase = new UpdateIdleThresholdUseCase(settings, watch);

			expect(() => updateIdleThreshold(useCase, request)).toThrow(InvalidIpcRequestError);
		},
	);

	it('範囲外の閾値は保存しない', async () => {
		const useCase = new UpdateIdleThresholdUseCase(settings, watch);

		await expect(updateIdleThreshold(useCase, { minutes: 1000 })).rejects.toThrow('1〜240 分');
		expect(settings.get().idleThresholdMinutes).toBe(30);
	});
});
