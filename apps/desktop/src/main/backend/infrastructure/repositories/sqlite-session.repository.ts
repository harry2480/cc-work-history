import type Database from 'better-sqlite3';
import { Activity } from '../../domain/models/activity.model';
import { Session } from '../../domain/models/session.model';
import type {
	Period,
	SessionFilter,
	SessionRepository,
	SessionWithProject,
} from '../../domain/repositories/session.repository';
import { type ProjectRow, SqliteProjectRepository } from './sqlite-project.repository';

type SessionRow = {
	id: string;
	project_id: string;
	cwd: string | null;
	started_at: number;
	ended_at: number;
	input_tokens: number;
	output_tokens: number;
	message_count: number;
	models: string;
};

type ActivityRow = {
	session_id: string;
	seq: number;
	started_at: number;
	ended_at: number;
	message_count: number;
};

type SessionWithProjectRow = SessionRow & {
	project_path: string;
	project_last_activity_at: number;
};

const SELECT_SESSION_WITH_PROJECT = `
	SELECT s.*, p.path AS project_path, p.last_activity_at AS project_last_activity_at
	FROM sessions s JOIN projects p ON p.id = s.project_id`;

export class SqliteSessionRepository implements SessionRepository {
	constructor(private readonly db: Database.Database) {}

	save(session: Session): void {
		this.db.transaction(() => {
			this.db
				.prepare(
					`INSERT INTO sessions
						(id, project_id, cwd, started_at, ended_at, input_tokens, output_tokens, message_count, models)
					VALUES
						(@id, @project_id, @cwd, @started_at, @ended_at, @input_tokens, @output_tokens, @message_count, @models)
					ON CONFLICT (id) DO UPDATE SET
						project_id = excluded.project_id, cwd = excluded.cwd,
						started_at = excluded.started_at, ended_at = excluded.ended_at,
						input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens,
						message_count = excluded.message_count, models = excluded.models`,
				)
				.run({
					id: session.id,
					project_id: session.projectId,
					cwd: session.cwd,
					started_at: session.startedAt.getTime(),
					ended_at: session.endedAt.getTime(),
					input_tokens: session.inputTokens,
					output_tokens: session.outputTokens,
					message_count: session.messageCount,
					models: JSON.stringify(session.models),
				});

			// 活動区間は再計算の結果で丸ごと置き換える
			this.db.prepare<[string]>('DELETE FROM activities WHERE session_id = ?').run(session.id);
			const insertActivity = this.db.prepare<[string, number, number, number, number]>(
				'INSERT INTO activities (session_id, seq, started_at, ended_at, message_count) VALUES (?, ?, ?, ?, ?)',
			);
			session.activities.forEach((activity, seq) => {
				insertActivity.run(
					session.id,
					seq,
					activity.startedAt.getTime(),
					activity.endedAt.getTime(),
					activity.messageCount,
				);
			});
		})();
	}

	findById(id: string): SessionWithProject | null {
		const row = this.db
			.prepare<[string], SessionWithProjectRow>(`${SELECT_SESSION_WITH_PROJECT} WHERE s.id = ?`)
			.get(id);
		if (!row) return null;
		return this.toSessionWithProject(row, this.findActivityRows([row.id]));
	}

	findByPeriod(period: Period, filter: SessionFilter = {}): SessionWithProject[] {
		const conditions = [
			`EXISTS (
				SELECT 1 FROM activities a
				WHERE a.session_id = s.id AND a.started_at < @to AND a.ended_at >= @from
			)`,
		];
		const params: Record<string, string | number> = {
			from: period.from.getTime(),
			to: period.to.getTime(),
		};
		if (filter.projectIds && filter.projectIds.length > 0) {
			conditions.push('s.project_id IN (SELECT value FROM json_each(@projectIds))');
			params.projectIds = JSON.stringify(filter.projectIds);
		}
		if (filter.tags && filter.tags.length > 0) {
			conditions.push(`EXISTS (
				SELECT 1 FROM session_tags st JOIN tags t ON t.id = st.tag_id
				WHERE st.session_id = s.id
					AND lower(t.name) IN (SELECT lower(value) FROM json_each(@tags))
			)`);
			params.tags = JSON.stringify(filter.tags);
		}
		const query = filter.query?.trim();
		if (query) {
			conditions.push("s.summary LIKE @query ESCAPE '\\'");
			params.query = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		}

		const rows = this.db
			.prepare<[Record<string, string | number>], SessionWithProjectRow>(
				`${SELECT_SESSION_WITH_PROJECT}
				WHERE ${conditions.join(' AND ')}
				ORDER BY s.started_at, s.id`,
			)
			.all(params);

		const activityRows = this.findActivityRows(rows.map((row) => row.id));
		return rows.map((row) => this.toSessionWithProject(row, activityRows));
	}

	private findActivityRows(sessionIds: readonly string[]): Map<string, ActivityRow[]> {
		const bySession = new Map<string, ActivityRow[]>();
		if (sessionIds.length === 0) return bySession;

		const rows = this.db
			.prepare<[string], ActivityRow>(
				`SELECT * FROM activities
				WHERE session_id IN (SELECT value FROM json_each(?))
				ORDER BY session_id, seq`,
			)
			.all(JSON.stringify(sessionIds));
		for (const row of rows) {
			const list = bySession.get(row.session_id) ?? [];
			list.push(row);
			bySession.set(row.session_id, list);
		}
		return bySession;
	}

	private toSessionWithProject(
		row: SessionWithProjectRow,
		activityRows: Map<string, ActivityRow[]>,
	): SessionWithProject {
		const project: ProjectRow = {
			id: row.project_id,
			path: row.project_path,
			last_activity_at: row.project_last_activity_at,
		};
		return {
			session: this.toSession(row, activityRows.get(row.id) ?? []),
			project: SqliteProjectRepository.toModel(project),
		};
	}

	private toSession(row: SessionRow, activityRows: readonly ActivityRow[]): Session {
		const activities = activityRows.map((a) => {
			const result = Activity.create({
				sessionId: a.session_id,
				startedAt: new Date(a.started_at),
				endedAt: new Date(a.ended_at),
				messageCount: a.message_count,
			});
			if (!result.success) {
				throw new Error(`activities の行が不正です（${a.session_id}#${a.seq}）: ${result.error}`);
			}
			return result.value;
		});

		const result = Session.create({
			id: row.id,
			projectId: row.project_id,
			cwd: row.cwd,
			startedAt: new Date(row.started_at),
			endedAt: new Date(row.ended_at),
			inputTokens: row.input_tokens,
			outputTokens: row.output_tokens,
			messageCount: row.message_count,
			models: parseModels(row.models),
			activities,
		});
		if (!result.success) throw new Error(`sessions の行が不正です（${row.id}）: ${result.error}`);
		return result.value;
	}
}

function parseModels(json: string): string[] {
	const value: unknown = JSON.parse(json);
	return Array.isArray(value) ? value.filter((m): m is string => typeof m === 'string') : [];
}
