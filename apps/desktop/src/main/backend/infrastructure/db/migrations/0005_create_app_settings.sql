-- アプリの設定（キーと値）。値は JSON で保存する
CREATE TABLE app_settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

-- 活動区間を計算したときの閾値（ミリ秒）。閾値が変わったファイルは取り込み直す。
-- 既存の行は既定値（30 分）で計算したもの
ALTER TABLE session_log_files ADD COLUMN idle_threshold_ms INTEGER NOT NULL DEFAULT 1800000;
