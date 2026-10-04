-- 取り込み済みのセッションログファイル。更新日時とサイズが変わったファイルだけを再取り込みする
CREATE TABLE session_log_files (
	path TEXT PRIMARY KEY,
	project_id TEXT NOT NULL,
	session_id TEXT NOT NULL,
	modified_at INTEGER NOT NULL,
	size_bytes INTEGER NOT NULL
);
