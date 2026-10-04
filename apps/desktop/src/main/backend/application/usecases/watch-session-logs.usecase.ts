import type { LogWatcherGateway } from '../../domain/gateways/log-watcher.gateway';
import type { ImportResult } from './import-session-logs.usecase';

/** 取り込みでセッションが変わったことの通知 */
export type SessionsChangedEvent = {
	sessionIds: string[];
	/** 変わったセッションが含まれる期間（最も早い開始〜最も遅い終了） */
	from: Date;
	to: Date;
};

type ImportSessionLogs = {
	execute(options: { projectIds?: readonly string[] }): Promise<ImportResult>;
};

type Options = {
	/** この時間内に続いた変更はまとめて 1 回で取り込む */
	debounceMs?: number;
	onError?: (error: unknown) => void;
};

/**
 * ログディレクトリの変更を監視し、変わったプロジェクトだけを差分取り込みして通知する。
 * 取り込み中に届いた変更は、取り込み完了後にもう一度まとめて処理する。
 */
export class WatchSessionLogsUseCase {
	private readonly debounceMs: number;
	private readonly onError: (error: unknown) => void;
	private readonly pendingProjectIds = new Set<string>();
	private timer: ReturnType<typeof setTimeout> | null = null;
	private running: Promise<void> | null = null;
	private stopped = false;

	constructor(
		private readonly watcher: LogWatcherGateway,
		private readonly importSessionLogs: ImportSessionLogs,
		private readonly onSessionsChanged: (event: SessionsChangedEvent) => void,
		options: Options = {},
	) {
		this.debounceMs = options.debounceMs ?? 1000;
		this.onError = options.onError ?? (() => {});
	}

	start(): void {
		this.stopped = false;
		this.watcher.start((change) => {
			this.pendingProjectIds.add(change.projectId);
			this.schedule();
		});
	}

	async stop(): Promise<void> {
		this.stopped = true;
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.pendingProjectIds.clear();
		await this.watcher.stop();
		await this.running;
	}

	/** 取り込み結果を通知する（変わったセッションがなければ何もしない） */
	publish(result: ImportResult): void {
		const sessions = result.importedSessions;
		if (sessions.length === 0) return;
		this.onSessionsChanged({
			sessionIds: sessions.map((s) => s.id),
			from: new Date(Math.min(...sessions.map((s) => s.startedAt.getTime()))),
			to: new Date(Math.max(...sessions.map((s) => s.endedAt.getTime()))),
		});
	}

	private schedule(): void {
		if (this.stopped) return;
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.timer = null;
			void this.flush();
		}, this.debounceMs);
	}

	private async flush(): Promise<void> {
		// 取り込み中なら、終わってから残りをまとめて処理する
		if (this.running) {
			await this.running;
			if (this.pendingProjectIds.size > 0) this.schedule();
			return;
		}
		const projectIds = [...this.pendingProjectIds];
		this.pendingProjectIds.clear();
		if (projectIds.length === 0 || this.stopped) return;

		this.running = this.importSessionLogs
			.execute({ projectIds })
			.then((result) => this.publish(result))
			.catch(this.onError)
			.finally(() => {
				this.running = null;
			});
		await this.running;
	}
}
