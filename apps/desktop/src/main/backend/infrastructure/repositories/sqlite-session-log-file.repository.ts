import type Database from 'better-sqlite3';
import type {
	ImportedSessionLogFile,
	SessionLogFileRepository,
} from '../../domain/repositories/session-log-file.repository';

type SessionLogFileRow = {
	path: string;
	project_id: string;
	session_id: string;
	modified_at: number;
	size_bytes: number;
	idle_threshold_ms: number;
};

export class SqliteSessionLogFileRepository implements SessionLogFileRepository {
	constructor(private readonly db: Database.Database) {}

	findAll(): Map<string, ImportedSessionLogFile> {
		const rows = this.db.prepare<[], SessionLogFileRow>('SELECT * FROM session_log_files').all();
		return new Map(
			rows.map((row) => [
				row.path,
				{
					path: row.path,
					projectId: row.project_id,
					sessionId: row.session_id,
					modifiedAt: new Date(row.modified_at),
					sizeBytes: row.size_bytes,
					idleThresholdMs: row.idle_threshold_ms,
				},
			]),
		);
	}

	save(file: ImportedSessionLogFile): void {
		this.db
			.prepare<[string, string, string, number, number, number]>(
				`INSERT INTO session_log_files
					(path, project_id, session_id, modified_at, size_bytes, idle_threshold_ms)
				VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT (path) DO UPDATE SET
					project_id = excluded.project_id, session_id = excluded.session_id,
					modified_at = excluded.modified_at, size_bytes = excluded.size_bytes,
					idle_threshold_ms = excluded.idle_threshold_ms`,
			)
			.run(
				file.path,
				file.projectId,
				file.sessionId,
				file.modifiedAt.getTime(),
				file.sizeBytes,
				file.idleThresholdMs,
			);
	}
}
