-- セッションの概要とタグ。ログの再取り込み（sessions の upsert）では変更しない

ALTER TABLE sessions ADD COLUMN summary TEXT;
-- 1 ならユーザーが概要を手動で編集した（自動生成で上書きしない）
ALTER TABLE sessions ADD COLUMN summary_edited_manually INTEGER NOT NULL DEFAULT 0;

CREATE TABLE tags (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE session_tags (
	session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
	tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
	-- manual: ユーザーが付けた / auto: 自動生成
	source TEXT NOT NULL CHECK (source IN ('manual', 'auto')),
	PRIMARY KEY (session_id, tag_id)
);

CREATE INDEX session_tags_tag_id ON session_tags (tag_id);
