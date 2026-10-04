import { Activity } from './activity.model';
import type { Result } from './result.model';
import type { SessionLogEntry } from './session-log-entry.model';

/** メッセージ間がこれより空いたら別の活動区間に分ける。進行中の判定にも使う */
export const DEFAULT_IDLE_THRESHOLD_MS = 30 * 60 * 1000;

export type SessionStatus = 'active' | 'completed';

export type SessionError =
	| 'EMPTY_ID'
	| 'EMPTY_PROJECT_ID'
	| 'NO_ENTRIES'
	| 'INVALID_TIMESTAMP'
	| 'ENDED_BEFORE_STARTED'
	| 'NEGATIVE_COUNT'
	| 'INVALID_ACTIVITY';

type SessionProps = {
	id: string;
	projectId: string;
	cwd: string | null;
	startedAt: Date;
	endedAt: Date;
	inputTokens: number;
	outputTokens: number;
	messageCount: number;
	/** 使われたモデル（初出順・重複なし） */
	models: readonly string[];
	activities: readonly Activity[];
};

type FromLogEntriesProps = {
	id: string;
	projectId: string;
	entries: readonly SessionLogEntry[];
	idleThresholdMs?: number;
};

export class Session {
	private constructor(private readonly props: SessionProps) {}

	/** 保存済みの値から復元する */
	static create(props: SessionProps): Result<Session, SessionError> {
		if (!props.id.trim()) return { success: false, error: 'EMPTY_ID' };
		if (!props.projectId.trim()) return { success: false, error: 'EMPTY_PROJECT_ID' };
		if (props.endedAt < props.startedAt) return { success: false, error: 'ENDED_BEFORE_STARTED' };
		if (props.inputTokens < 0 || props.outputTokens < 0 || props.messageCount < 0) {
			return { success: false, error: 'NEGATIVE_COUNT' };
		}
		return { success: true, value: new Session({ ...props, models: [...props.models] }) };
	}

	/** ログのメッセージからセッションを組み立てる。メッセージ間が閾値を超えて空いたら活動区間を分ける */
	static fromLogEntries({
		id,
		projectId,
		entries,
		idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS,
	}: FromLogEntriesProps): Result<Session, SessionError> {
		if (!id.trim()) return { success: false, error: 'EMPTY_ID' };
		if (!projectId.trim()) return { success: false, error: 'EMPTY_PROJECT_ID' };
		if (entries.length === 0) return { success: false, error: 'NO_ENTRIES' };
		if (entries.some((e) => Number.isNaN(e.timestamp.getTime()))) {
			return { success: false, error: 'INVALID_TIMESTAMP' };
		}

		const sorted = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
		const activities = Session.splitIntoActivities(id, sorted, idleThresholdMs);
		if (!activities.success) return activities;

		const first = sorted[0] as SessionLogEntry;
		const last = sorted.at(-1) as SessionLogEntry;
		return Session.create({
			id,
			projectId,
			cwd: sorted.find((e) => e.cwd)?.cwd ?? null,
			startedAt: first.timestamp,
			endedAt: last.timestamp,
			inputTokens: sum(sorted.map((e) => e.inputTokens)),
			outputTokens: sum(sorted.map((e) => e.outputTokens)),
			messageCount: sorted.length,
			models: [...new Set(sorted.flatMap((e) => (e.model ? [e.model] : [])))],
			activities: activities.value,
		});
	}

	get id(): string {
		return this.props.id;
	}
	get projectId(): string {
		return this.props.projectId;
	}
	get cwd(): string | null {
		return this.props.cwd;
	}
	get startedAt(): Date {
		return this.props.startedAt;
	}
	get endedAt(): Date {
		return this.props.endedAt;
	}
	get inputTokens(): number {
		return this.props.inputTokens;
	}
	get outputTokens(): number {
		return this.props.outputTokens;
	}
	get totalTokens(): number {
		return this.props.inputTokens + this.props.outputTokens;
	}
	get messageCount(): number {
		return this.props.messageCount;
	}
	get models(): readonly string[] {
		return this.props.models;
	}
	get activities(): readonly Activity[] {
		return this.props.activities;
	}
	/** 活動区間の合計時間（放置していた時間は含まない） */
	get activeDurationMs(): number {
		return sum(this.props.activities.map((a) => a.durationMs));
	}

	/** 最後のメッセージから閾値以内なら進行中 */
	status(now: Date, idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS): SessionStatus {
		return now.getTime() - this.props.endedAt.getTime() <= idleThresholdMs ? 'active' : 'completed';
	}

	private static splitIntoActivities(
		sessionId: string,
		sorted: readonly SessionLogEntry[],
		idleThresholdMs: number,
	): Result<Activity[], SessionError> {
		const groups: SessionLogEntry[][] = [];
		for (const entry of sorted) {
			const current = groups.at(-1);
			const previous = current?.at(-1);
			if (
				current &&
				previous &&
				entry.timestamp.getTime() - previous.timestamp.getTime() <= idleThresholdMs
			) {
				current.push(entry);
			} else {
				groups.push([entry]);
			}
		}

		const activities: Activity[] = [];
		for (const group of groups) {
			const activity = Activity.create({
				sessionId,
				startedAt: (group[0] as SessionLogEntry).timestamp,
				endedAt: (group.at(-1) as SessionLogEntry).timestamp,
				messageCount: group.length,
			});
			if (!activity.success) return { success: false, error: 'INVALID_ACTIVITY' };
			activities.push(activity.value);
		}
		return { success: true, value: activities };
	}
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}
