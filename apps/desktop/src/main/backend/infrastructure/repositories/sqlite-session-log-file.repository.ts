import type Database from 'better-sqlite3';
import type { SessionLogFile } from '../../domain/gateways/session-log.gateway';
import type { SessionLogFileRepository } from '../../domain/repositories/session-log-file.repository';

type SessionLogFileRow = {
	path: string;
	project_id: string;
	session_id: string;
	modified_at: number;
	size_bytes: number;
};

export class SqliteSessionLogFileRepository implements SessionLogFileRepository {
	constructor(private readonly db: Database.Database) {}

	findAll(): Map<string, SessionLogFile> {
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
				},
			]),
		);
	}

	save(file: SessionLogFile): void {
		this.db
			.prepare<[string, string, string, number, number]>(
				`INSERT INTO session_log_files (path, project_id, session_id, modified_at, size_bytes)
				VALUES (?, ?, ?, ?, ?)
				ON CONFLICT (path) DO UPDATE SET
					project_id = excluded.project_id, session_id = excluded.session_id,
					modified_at = excluded.modified_at, size_bytes = excluded.size_bytes`,
			)
			.run(file.path, file.projectId, file.sessionId, file.modifiedAt.getTime(), file.sizeBytes);
	}
}
