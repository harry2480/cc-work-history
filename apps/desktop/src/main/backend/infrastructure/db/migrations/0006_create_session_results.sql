-- セッションの成果（期間中の自分のコミット数・変更ファイル数）。git から集計して保存する
CREATE TABLE session_results (
	session_id TEXT PRIMARY KEY REFERENCES sessions (id) ON DELETE CASCADE,
	-- commits: 集計できた / no_repository: 作業ディレクトリが git リポジトリでない
	kind TEXT NOT NULL CHECK (kind IN ('commits', 'no_repository')),
	commit_count INTEGER NOT NULL DEFAULT 0,
	changed_file_count INTEGER NOT NULL DEFAULT 0,
	-- 集計したときのセッションの終了日時。セッションが更新されたら集計し直す
	session_ended_at INTEGER NOT NULL,
	computed_at INTEGER NOT NULL
);
