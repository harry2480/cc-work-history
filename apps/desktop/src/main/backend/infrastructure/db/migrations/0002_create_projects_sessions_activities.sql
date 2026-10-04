-- 日時はすべて UTC のエポックミリ秒（INTEGER）で保存する

CREATE TABLE projects (
	id TEXT PRIMARY KEY,
	path TEXT NOT NULL,
	last_activity_at INTEGER NOT NULL
);

CREATE TABLE sessions (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
	cwd TEXT,
	started_at INTEGER NOT NULL,
	ended_at INTEGER NOT NULL,
	input_tokens INTEGER NOT NULL,
	output_tokens INTEGER NOT NULL,
	message_count INTEGER NOT NULL,
	-- 使われたモデル名の JSON 配列（初出順）
	models TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX sessions_project_id ON sessions (project_id);

-- タイムラインに表示する活動区間（無操作時間で分割したもの）
CREATE TABLE activities (
	session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
	seq INTEGER NOT NULL,
	started_at INTEGER NOT NULL,
	ended_at INTEGER NOT NULL,
	message_count INTEGER NOT NULL,
	PRIMARY KEY (session_id, seq)
);

CREATE INDEX activities_period ON activities (started_at, ended_at);
