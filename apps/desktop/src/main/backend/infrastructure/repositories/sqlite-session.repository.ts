import type Database from 'better-sqlite3';
import { Activity } from '../../domain/models/activity.model';
import { Session } from '../../domain/models/session.model';
import { TodoList } from '../../domain/models/todo-list.model';
import type {
	Period,
	SessionFilter,
	SessionRepository,
	SessionSearch,
	SessionSortKey,
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

type SessionTodoRow = {
	session_id: string;
	seq: number;
	content: string;
	status: string;
};

type SessionWithProjectRow = SessionRow & {
	project_path: string;
	project_last_activity_at: number;
};

/** 並び替えの列（固定の候補だけを SQL に埋め込む） */
const SORT_COLUMNS: Record<SessionSortKey, string> = {
	startedAt: 's.started_at',
	project: 'p.path COLLATE NOCASE',
	activeDuration:
		'(SELECT COALESCE(SUM(a.ended_at - a.started_at), 0) FROM activities a WHERE a.session_id = s.id)',
	totalTokens: '(s.input_tokens + s.output_tokens)',
};

const SELECT_SESSION_WITH_PROJECT = `
	SELECT s.*, p.path AS project_path, p.last_activity_at AS project_last_activity_at
	FROM sessions s JOIN projects p ON p.id = s.project_id`;

/** 非表示のプロジェクトのセッションを除く条件（sessions を s として参照する） */
const EXCLUDE_HIDDEN_PROJECTS = 's.project_id NOT IN (SELECT id FROM projects WHERE hidden = 1)';

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

			// 作業状況チェックリストもログから作り直した内容で丸ごと置き換える
			this.db.prepare<[string]>('DELETE FROM session_todos WHERE session_id = ?').run(session.id);
			const insertTodo = this.db.prepare<[string, number, string, string]>(
				'INSERT INTO session_todos (session_id, seq, content, status) VALUES (?, ?, ?, ?)',
			);
			session.todos.items.forEach((todo, seq) => {
				insertTodo.run(session.id, seq, todo.content, todo.status);
			});
		})();
	}

	findById(id: string): SessionWithProject | null {
		const row = this.db
			.prepare<[string], SessionWithProjectRow>(`${SELECT_SESSION_WITH_PROJECT} WHERE s.id = ?`)
			.get(id);
		if (!row) return null;
		return this.toSessionWithProject(
			row,
			this.findActivityRows([row.id]),
			this.findTodoRows([row.id]),
		);
	}

	findByPeriod(period: Period, filter: SessionFilter = {}): SessionWithProject[] {
		const params: Record<string, string | number> = {
			from: period.from.getTime(),
			to: period.to.getTime(),
		};
		const conditions = [
			`EXISTS (
				SELECT 1 FROM activities a
				WHERE a.session_id = s.id AND a.started_at < @to AND a.ended_at >= @from
			)`,
			...this.filterConditions(filter, params),
		];

		const rows = this.db
			.prepare<[Record<string, string | number>], SessionWithProjectRow>(
				`${SELECT_SESSION_WITH_PROJECT}
				WHERE ${conditions.join(' AND ')}
				ORDER BY s.started_at, s.id`,
			)
			.all(params);

		const ids = rows.map((row) => row.id);
		const activityRows = this.findActivityRows(ids);
		// チェックリストは詳細（findById）でしか使わないので、一覧では読まない
		const todoRows = new Map<string, SessionTodoRow[]>();
		return rows.map((row) => this.toSessionWithProject(row, activityRows, todoRows));
	}

	search({ filter = {}, sort, offset, limit }: SessionSearch): {
		items: SessionWithProject[];
		total: number;
	} {
		const params: Record<string, string | number> = { offset, limit };
		const conditions = this.filterConditions(filter, params);
		const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
		const direction = sort.direction === 'asc' ? 'ASC' : 'DESC';

		const { total } = this.db
			.prepare<[Record<string, string | number>], { total: number }>(
				`SELECT COUNT(*) AS total FROM sessions s ${where}`,
			)
			.get(params) ?? { total: 0 };
		const rows = this.db
			.prepare<[Record<string, string | number>], SessionWithProjectRow>(
				`${SELECT_SESSION_WITH_PROJECT}
				${where}
				ORDER BY ${SORT_COLUMNS[sort.key]} ${direction}, s.started_at DESC, s.id
				LIMIT @limit OFFSET @offset`,
			)
			.all(params);

		const ids = rows.map((row) => row.id);
		const activityRows = this.findActivityRows(ids);
		// チェックリストは詳細（findById）でしか使わないので、一覧では読まない
		const todoRows = new Map<string, SessionTodoRow[]>();
		return {
			items: rows.map((row) => this.toSessionWithProject(row, activityRows, todoRows)),
			total,
		};
	}

	/** 絞り込み条件の SQL（params に値を追加する）。非表示のプロジェクトは常に除く */
	private filterConditions(
		filter: SessionFilter,
		params: Record<string, string | number>,
	): string[] {
		const conditions: string[] = [EXCLUDE_HIDDEN_PROJECTS];
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
		return conditions;
	}

	private findActivityRows(sessionIds: readonly string[]): Map<string, ActivityRow[]> {
		if (sessionIds.length === 0) return new Map();
		return groupBySession(
			this.db
				.prepare<[string], ActivityRow>(
					`SELECT * FROM activities
					WHERE session_id IN (SELECT value FROM json_each(?))
					ORDER BY session_id, seq`,
				)
				.all(JSON.stringify(sessionIds)),
		);
	}

	private findTodoRows(sessionIds: readonly string[]): Map<string, SessionTodoRow[]> {
		if (sessionIds.length === 0) return new Map();
		return groupBySession(
			this.db
				.prepare<[string], SessionTodoRow>(
					`SELECT * FROM session_todos
					WHERE session_id IN (SELECT value FROM json_each(?))
					ORDER BY session_id, seq`,
				)
				.all(JSON.stringify(sessionIds)),
		);
	}

	private toSessionWithProject(
		row: SessionWithProjectRow,
		activityRows: Map<string, ActivityRow[]>,
		todoRows: Map<string, SessionTodoRow[]>,
	): SessionWithProject {
		const project: ProjectRow = {
			id: row.project_id,
			path: row.project_path,
			last_activity_at: row.project_last_activity_at,
		};
		return {
			session: this.toSession(row, activityRows.get(row.id) ?? [], todoRows.get(row.id) ?? []),
			project: SqliteProjectRepository.toModel(project),
		};
	}

	private toSession(
		row: SessionRow,
		activityRows: readonly ActivityRow[],
		todoRows: readonly SessionTodoRow[],
	): Session {
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

		const todos = TodoList.create(todoRows);
		if (!todos.success) {
			throw new Error(`session_todos の行が不正です（${row.id}）: ${todos.error}`);
		}

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
			todos: todos.value,
		});
		if (!result.success) throw new Error(`sessions の行が不正です（${row.id}）: ${result.error}`);
		return result.value;
	}
}

function groupBySession<T extends { session_id: string }>(rows: readonly T[]): Map<string, T[]> {
	const bySession = new Map<string, T[]>();
	for (const row of rows) {
		const list = bySession.get(row.session_id) ?? [];
		list.push(row);
		bySession.set(row.session_id, list);
	}
	return bySession;
}

function parseModels(json: string): string[] {
	const value: unknown = JSON.parse(json);
	return Array.isArray(value) ? value.filter((m): m is string => typeof m === 'string') : [];
}
