-- セッションの作業状況チェックリスト（ログ中の Claude Code の TodoWrite ツールの最後の状態）。
-- ログから取り込む読み取り専用の情報で、セッションの取り込み（sessions の upsert）のたびに丸ごと置き換える
CREATE TABLE session_todos (
	session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
	-- リスト内の順番（0 始まり）
	seq INTEGER NOT NULL,
	content TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
	PRIMARY KEY (session_id, seq)
);

-- 取り込み済みのセッションにもチェックリストを作るため、次回の取り込みですべてのログを読み直す。
-- sessions の upsert は概要・タグを変更しないため、手動で編集した内容は残る
DELETE FROM session_log_files;
