/** セッションログファイルの追加・変更 */
export type LogFileChange = {
	projectId: string;
	path: string;
};

/** セッションログのディレクトリを監視する。ログは読み取り専用で、書き換えない */
export interface LogWatcherGateway {
	start(onChange: (change: LogFileChange) => void): void;
	stop(): Promise<void>;
}
