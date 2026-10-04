export type CommitQuery = {
	/** セッションの作業ディレクトリ。ここから git リポジトリを探す */
	cwd: string;
	since: Date;
	until: Date;
};

export type CommitStats = {
	commitCount: number;
	/** 期間中のコミットで変更されたファイルの数（重複なし） */
	changedFileCount: number;
};

export type CommitStatsResult =
	| { status: 'ok'; value: CommitStats }
	/** 作業ディレクトリがない、または git リポジトリでない */
	| { status: 'no_repository' }
	/** git が見つからない・作者のメールアドレスが設定されていないなど、集計できない環境 */
	| { status: 'unavailable'; reason: string }
	| { status: 'failed'; reason: string };

/** git リポジトリから、期間中の自分（git config user.email）のコミットを集計する */
export interface GitGateway {
	commitStats(query: CommitQuery): Promise<CommitStatsResult>;
}
