/**
 * `migrations/` 配下の SQL をビルド時に取り込む。
 * ファイル名は `<4 桁の連番>_<説明>.sql`（例: `0002_create_sessions.sql`）。
 */
export const migrationFiles: Record<string, string> = import.meta.glob<string>(
	'./migrations/*.sql',
	{ query: '?raw', import: 'default', eager: true },
);
