import type { LogFileChange, LogWatcherGateway } from '../../domain/gateways/log-watcher.gateway';

/** テスト・開発用。`emit` で手動で変更イベントを発火する */
export class StubLogWatcherAdapter implements LogWatcherGateway {
	private onChange: ((change: LogFileChange) => void) | null = null;

	get isWatching(): boolean {
		return this.onChange !== null;
	}

	start(onChange: (change: LogFileChange) => void): void {
		this.onChange = onChange;
	}

	async stop(): Promise<void> {
		this.onChange = null;
	}

	emit(change: LogFileChange): void {
		this.onChange?.(change);
	}
}
