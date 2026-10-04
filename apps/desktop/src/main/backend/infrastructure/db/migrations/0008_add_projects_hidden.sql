-- プロジェクトを非表示にするか（1 なら タイムライン・一覧・ダッシュボード・絞り込みの選択肢に出さない）。
-- 取り込みは続けるので、表示に戻せばすぐに見える
ALTER TABLE projects ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
