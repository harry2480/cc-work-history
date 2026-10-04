import type { LogFileChange, LogWatcherGateway } from '../../domain/gateways/log-watcher.gateway';

/** テスト・開発用。`emit` で手動で変更イベントを発火する */
export class StubLogWatcherAdapter implements LogWatcherGateway {
	private onChange: ((change: LogFileChange) => void) | null = null;
	private onError: ((error: unknown) => void) | null = null;

	get isWatching(): boolean {
		return this.onChange !== null;
	}

	start(onChange: (change: LogFileChange) => void, onError?: (error: unknown) => void): void {
		this.onChange = onChange;
		this.onError = onError ?? null;
	}

	async stop(): Promise<void> {
		this.onChange = null;
		this.onError = null;
	}

	emit(change: LogFileChange): void {
		this.onChange?.(change);
	}

	/** 監視のエラーを発生させる */
	fail(error: unknown): void {
		this.onError?.(error);
	}
}
