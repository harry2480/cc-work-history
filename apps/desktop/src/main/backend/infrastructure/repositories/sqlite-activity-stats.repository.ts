import type Database from 'better-sqlite3';
import type {
	ActivityStatsRepository,
	PeriodStats,
	ProjectStats,
} from '../../domain/repositories/activity-stats.repository';
import type { Period } from '../../domain/repositories/session.repository';

/** 期間に重なる活動区間（期間内に切り詰めた長さ付き） */
const CLIPPED_ACTIVITIES = `
	SELECT a.session_id,
		MAX(0, MIN(a.ended_at, @to) - MAX(a.started_at, @from)) AS active_ms
	FROM activities a
	WHERE a.started_at < @to AND a.ended_at >= @from`;

type StatsRow = {
	active_ms: number | null;
	session_count: number;
	total_tokens: number | null;
	message_count: number | null;
};

export class SqliteActivityStatsRepository implements ActivityStatsRepository {
	constructor(private readonly db: Database.Database) {}

	summarize(period: Period): PeriodStats {
		const row = this.db
			.prepare<[{ from: number; to: number }], StatsRow>(
				`WITH clipped AS (${CLIPPED_ACTIVITIES}),
				per_session AS (SELECT session_id, SUM(active_ms) AS active_ms FROM clipped GROUP BY session_id)
				SELECT SUM(ps.active_ms) AS active_ms,
					COUNT(*) AS session_count,
					SUM(s.input_tokens + s.output_tokens) AS total_tokens,
					SUM(s.message_count) AS message_count
				FROM per_session ps JOIN sessions s ON s.id = ps.session_id`,
			)
			.get(toParams(period));
		return toStats(row);
	}

	summarizeByBuckets(buckets: readonly Period[]): PeriodStats[] {
		const statement = this.db.prepare<[{ from: number; to: number }], StatsRow>(
			`WITH clipped AS (${CLIPPED_ACTIVITIES})
			SELECT SUM(c.active_ms) AS active_ms,
				COUNT(DISTINCT c.session_id) AS session_count,
				NULL AS total_tokens,
				NULL AS message_count
			FROM clipped c`,
		);
		return buckets.map((bucket) => toStats(statement.get(toParams(bucket))));
	}

	summarizeByProject(period: Period): ProjectStats[] {
		return this.db
			.prepare<
				[{ from: number; to: number }],
				{
					project_id: string;
					project_path: string;
					active_ms: number;
					session_count: number;
					total_tokens: number;
				}
			>(
				`WITH clipped AS (${CLIPPED_ACTIVITIES}),
				per_session AS (SELECT session_id, SUM(active_ms) AS active_ms FROM clipped GROUP BY session_id)
				SELECT p.id AS project_id, p.path AS project_path,
					SUM(ps.active_ms) AS active_ms,
					COUNT(*) AS session_count,
					SUM(s.input_tokens + s.output_tokens) AS total_tokens
				FROM per_session ps
				JOIN sessions s ON s.id = ps.session_id
				JOIN projects p ON p.id = s.project_id
				GROUP BY p.id
				ORDER BY active_ms DESC, p.id`,
			)
			.all(toParams(period))
			.map((row) => ({
				projectId: row.project_id,
				projectPath: row.project_path,
				activeMs: row.active_ms,
				sessionCount: row.session_count,
				totalTokens: row.total_tokens,
			}));
	}
}

function toParams(period: Period) {
	return { from: period.from.getTime(), to: period.to.getTime() };
}

function toStats(row: StatsRow | undefined): PeriodStats {
	return {
		activeMs: row?.active_ms ?? 0,
		sessionCount: row?.session_count ?? 0,
		totalTokens: row?.total_tokens ?? 0,
		messageCount: row?.message_count ?? 0,
	};
}
