import { relative, sep } from 'node:path';
import { type FSWatcher, watch } from 'chokidar';
import type { LogFileChange, LogWatcherGateway } from '../../domain/gateways/log-watcher.gateway';

const SESSION_FILE_EXTENSION = '.jsonl';

/** `<ルート>/<プロジェクト>/<sessionId>.jsonl` の追加・変更を chokidar で監視する */
export class ChokidarLogWatcherAdapter implements LogWatcherGateway {
	private watcher: FSWatcher | null = null;

	constructor(private readonly rootDir: string) {}

	start(onChange: (change: LogFileChange) => void): void {
		if (this.watcher) return;

		this.watcher = watch(this.rootDir, {
			// 起動時の既存ファイルは取り込み UseCase が処理する
			ignoreInitial: true,
			// ルート直下のプロジェクトディレクトリの中まで
			depth: 1,
			ignored: (path, stats) => stats?.isFile() === true && !path.endsWith(SESSION_FILE_EXTENSION),
		});

		const handle = (path: string) => {
			const change = this.toChange(path);
			if (change) onChange(change);
		};
		this.watcher.on('add', handle).on('change', handle);
	}

	async stop(): Promise<void> {
		await this.watcher?.close();
		this.watcher = null;
	}

	private toChange(path: string): LogFileChange | null {
		if (!path.endsWith(SESSION_FILE_EXTENSION)) return null;
		const segments = relative(this.rootDir, path).split(sep);
		// <プロジェクト>/<ファイル> の形のものだけを対象にする
		if (segments.length !== 2 || !segments[0]) return null;
		return { projectId: segments[0], path };
	}
}
