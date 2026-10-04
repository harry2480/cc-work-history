import type { LogWatcherGateway } from '../../domain/gateways/log-watcher.gateway';
import type { ImportResult } from './import-session-logs.usecase';

/** 取り込みでセッションが変わったことの通知 */
export type SessionsChangedEvent = {
	sessionIds: string[];
	/** 変わったセッションが含まれる期間（最も早い開始〜最も遅い終了） */
	from: Date;
	to: Date;
};

/** 差分取り込みが失敗したときに再試行する回数 */
const MAX_RETRIES = 3;

type ImportSessionLogs = {
	execute(options: {
		projectIds?: readonly string[];
		shouldStop?: () => boolean;
	}): Promise<ImportResult>;
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
	/** 差分取り込みが続けて失敗した回数（上限まで、同じプロジェクトをもう一度取り込む） */
	private consecutiveFailures = 0;
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

	/** 終了処理が始まったら、取り込みを途中で打ち切る（記録はファイルごとなので、次回そこから続く） */
	private readonly isStopped = () => this.stopped;

	start(): void {
		this.stopped = false;
		this.watcher.start(
			(change) => {
				this.pendingProjectIds.add(change.projectId);
				this.schedule();
			},
			(error) => this.onError(error),
		);
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
		// 全件の取り込みでは件数が多いため、スプレッドで Math.min / max に渡さない
		let from = Number.POSITIVE_INFINITY;
		let to = Number.NEGATIVE_INFINITY;
		for (const session of sessions) {
			from = Math.min(from, session.startedAt.getTime());
			to = Math.max(to, session.endedAt.getTime());
		}
		this.onSessionsChanged({
			sessionIds: sessions.map((s) => s.id),
			from: new Date(from),
			to: new Date(to),
		});
	}

	/**
	 * すべてのプロジェクトを取り込み、通知する（起動時と、活動区間の閾値を変えたとき）。
	 * 差分取り込みの途中なら、終わってから始める。失敗したら呼び出し元に投げる
	 */
	async importAll(): Promise<ImportResult> {
		while (this.running) await this.running;
		if (this.stopped) throw new Error('終了処理中のため取り込めません');
		const task = this.importSessionLogs.execute({ shouldStop: this.isStopped }).then((result) => {
			this.publish(result);
			return result;
		});
		this.running = task.then(
			() => {
				this.running = null;
			},
			() => {
				this.running = null;
			},
		);
		return task;
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
			.execute({ projectIds, shouldStop: this.isStopped })
			.then((result) => {
				this.consecutiveFailures = 0;
				this.publish(result);
			})
			.catch((error) => {
				this.onError(error);
				// 一時的な失敗なら次の機会に取り込めるよう、対象のプロジェクトを戻して再試行する
				this.consecutiveFailures++;
				if (this.consecutiveFailures <= MAX_RETRIES && !this.stopped) {
					for (const id of projectIds) this.pendingProjectIds.add(id);
					this.schedule();
				} else {
					this.consecutiveFailures = 0;
				}
			})
			.finally(() => {
				this.running = null;
			});
		await this.running;
	}
}
