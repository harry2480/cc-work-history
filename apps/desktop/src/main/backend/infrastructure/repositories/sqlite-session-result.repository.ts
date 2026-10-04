import type Database from 'better-sqlite3';
import { SessionResult } from '../../domain/models/session-result.model';
import type { SessionResultRepository } from '../../domain/repositories/session-result.repository';

type SessionResultRow = {
	kind: 'commits' | 'no_repository';
	commit_count: number;
	changed_file_count: number;
	session_ended_at: number;
	computed_at: number;
};

export class SqliteSessionResultRepository implements SessionResultRepository {
	constructor(private readonly db: Database.Database) {}

	findBySessionId(sessionId: string): SessionResult | null {
		const row = this.db
			.prepare<[string], SessionResultRow>(
				`SELECT kind, commit_count, changed_file_count, session_ended_at, computed_at
				FROM session_results WHERE session_id = ?`,
			)
			.get(sessionId);
		if (!row) return null;

		const dates = {
			sessionEndedAt: new Date(row.session_ended_at),
			computedAt: new Date(row.computed_at),
		};
		const result =
			row.kind === 'commits'
				? SessionResult.create({
						kind: 'commits',
						commitCount: row.commit_count,
						changedFileCount: row.changed_file_count,
						...dates,
					})
				: SessionResult.create({ kind: 'no_repository', ...dates });
		// 壊れた行は保存されていないものとして扱い、集計し直させる
		return result.success ? result.value : null;
	}

	save(sessionId: string, result: SessionResult): void {
		const value = result.value;
		this.db
			.prepare<[string, string, number, number, number, number]>(
				`INSERT INTO session_results
					(session_id, kind, commit_count, changed_file_count, session_ended_at, computed_at)
				VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT (session_id) DO UPDATE SET
					kind = excluded.kind, commit_count = excluded.commit_count,
					changed_file_count = excluded.changed_file_count,
					session_ended_at = excluded.session_ended_at, computed_at = excluded.computed_at`,
			)
			.run(
				sessionId,
				value.kind,
				value.kind === 'commits' ? value.commitCount : 0,
				value.kind === 'commits' ? value.changedFileCount : 0,
				result.sessionEndedAt.getTime(),
				result.computedAt.getTime(),
			);
	}
}
