import type Database from 'better-sqlite3';
import {
	type SessionsChangedEvent,
	WatchSessionLogsUseCase,
} from '../../application/usecases/watch-session-logs.usecase';
import type { LogWatcherGateway } from '../../domain/gateways/log-watcher.gateway';
import { ChokidarLogWatcherAdapter } from '../../infrastructure/adapters/chokidar-log-watcher.adapter';
import { StubLogWatcherAdapter } from '../../infrastructure/adapters/stub-log-watcher.adapter';
import { createImportSessionLogsUseCase } from './import-session-logs.composition';
import { resolveSessionLogRootDir } from './session-log.composition';

type Env = Record<string, string | undefined>;

/** `CC_WORK_HISTORY_STUB_LOGS=true` なら監視しない Stub、それ以外は chokidar */
export function createLogWatcherGateway(env: Env = process.env): LogWatcherGateway {
	if (env.CC_WORK_HISTORY_STUB_LOGS === 'true') return new StubLogWatcherAdapter();
	return new ChokidarLogWatcherAdapter(resolveSessionLogRootDir(env));
}

export function createWatchSessionLogsUseCase(
	db: Database.Database,
	onSessionsChanged: (event: SessionsChangedEvent) => void,
	env: Env = process.env,
): WatchSessionLogsUseCase {
	return new WatchSessionLogsUseCase(
		createLogWatcherGateway(env),
		createImportSessionLogsUseCase(db, env),
		onSessionsChanged,
		{
			// 応答中のセッションは追記が続くので、まとめて読む間隔を空けて main の負荷を抑える
			debounceMs: 3000,
			onError: (error) => console.error('[watch] 監視・差分取り込みに失敗しました', error),
		},
	);
}
