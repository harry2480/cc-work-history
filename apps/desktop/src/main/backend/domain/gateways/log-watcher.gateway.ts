/** セッションログファイルの追加・変更 */
export type LogFileChange = {
	projectId: string;
	path: string;
};

/** セッションログのディレクトリを監視する。ログは読み取り専用で、書き換えない */
export interface LogWatcherGateway {
	/** onError: 監視中のエラー（権限・ファイル数の上限など）。監視は続ける */
	start(onChange: (change: LogFileChange) => void, onError?: (error: unknown) => void): void;
	stop(): Promise<void>;
}
