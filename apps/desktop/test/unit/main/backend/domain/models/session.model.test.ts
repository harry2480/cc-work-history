import { describe, expect, it } from 'vitest';
import type { SessionLogEntry } from '../../../../../../src/main/backend/domain/models/session-log-entry.model';
import {
	DEFAULT_IDLE_THRESHOLD_MS,
	Session,
} from '../../../../../../src/main/backend/domain/models/session.model';

const MIN = 60 * 1000;
const base = new Date('2026-10-01T09:00:00Z').getTime();

function entry(offsetMin: number, overrides: Partial<SessionLogEntry> = {}): SessionLogEntry {
	return {
		timestamp: new Date(base + offsetMin * MIN),
		role: 'user',
		inputTokens: 0,
		outputTokens: 0,
		...overrides,
	};
}

function build(entries: SessionLogEntry[], idleThresholdMs?: number): Session {
	const result = Session.fromLogEntries({ id: 's1', projectId: 'p1', entries, idleThresholdMs });
	if (!result.success) throw new Error(result.error);
	return result.value;
}

describe('Session.fromLogEntries', () => {
	it('時刻・トークン数・メッセージ数・モデル・作業ディレクトリを集計する', () => {
		const session = build([
			entry(10, {
				role: 'assistant',
				model: 'claude-opus-5-5',
				inputTokens: 100,
				outputTokens: 20,
			}),
			entry(0, { cwd: '/repo/app', inputTokens: 5 }),
			entry(20, { role: 'assistant', model: 'claude-sonnet-5-5', outputTokens: 7 }),
			entry(15, { role: 'assistant', model: 'claude-opus-5-5', inputTokens: 1 }),
		]);

		expect(session.startedAt).toEqual(new Date(base));
		expect(session.endedAt).toEqual(new Date(base + 20 * MIN));
		expect(session.inputTokens).toBe(106);
		expect(session.outputTokens).toBe(27);
		expect(session.totalTokens).toBe(133);
		expect(session.messageCount).toBe(4);
		expect(session.models).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5']);
		expect(session.cwd).toBe('/repo/app');
	});

	it('メッセージ間が閾値を超えたら活動区間を分ける', () => {
		const session = build([entry(0), entry(10), entry(41), entry(50), entry(200)]);

		expect(
			session.activities.map((a) => [a.startedAt.getTime(), a.endedAt.getTime(), a.messageCount]),
		).toEqual([
			[base, base + 10 * MIN, 2],
			[base + 41 * MIN, base + 50 * MIN, 2],
			[base + 200 * MIN, base + 200 * MIN, 1],
		]);
		// 放置時間（10→41 分、50→200 分）は含まない
		expect(session.activeDurationMs).toBe(19 * MIN);
	});

	it('間隔が閾値ちょうどなら同じ区間にする', () => {
		const session = build([entry(0), entry(30)]);

		expect(session.activities).toHaveLength(1);
	});

	it('閾値を 1 ミリ秒でも超えたら別の区間にする', () => {
		const session = build([entry(0), { ...entry(30), timestamp: new Date(base + 30 * MIN + 1) }]);

		expect(session.activities).toHaveLength(2);
	});

	it('閾値を引数で変更できる', () => {
		const session = build([entry(0), entry(10)], 5 * MIN);

		expect(session.activities).toHaveLength(2);
	});

	it('メッセージ 1 件なら、長さ 0 の区間が 1 つになる', () => {
		const session = build([entry(0)]);

		expect(session.activities).toHaveLength(1);
		expect(session.activities[0]?.durationMs).toBe(0);
		expect(session.startedAt).toEqual(session.endedAt);
	});

	it('メッセージ 0 件（区間 0 件）はエラーにする', () => {
		const result = Session.fromLogEntries({ id: 's1', projectId: 'p1', entries: [] });

		expect(result).toEqual({ success: false, error: 'NO_ENTRIES' });
	});

	it('不正な時刻を含む場合はエラーにする', () => {
		const result = Session.fromLogEntries({
			id: 's1',
			projectId: 'p1',
			entries: [{ ...entry(0), timestamp: new Date('invalid') }],
		});

		expect(result).toEqual({ success: false, error: 'INVALID_TIMESTAMP' });
	});

	it('ID が空ならエラーにする', () => {
		expect(Session.fromLogEntries({ id: ' ', projectId: 'p1', entries: [entry(0)] })).toEqual({
			success: false,
			error: 'EMPTY_ID',
		});
		expect(Session.fromLogEntries({ id: 's1', projectId: '', entries: [entry(0)] })).toEqual({
			success: false,
			error: 'EMPTY_PROJECT_ID',
		});
	});
});

describe('Session.status', () => {
	const session = build([entry(0), entry(10)]);
	const endedAt = base + 10 * MIN;

	it('最後のメッセージから閾値以内なら進行中', () => {
		expect(session.status(new Date(endedAt + 5 * MIN))).toBe('active');
	});

	it('経過がちょうど閾値なら進行中', () => {
		expect(session.status(new Date(endedAt + DEFAULT_IDLE_THRESHOLD_MS))).toBe('active');
	});

	it('閾値を超えたら完了', () => {
		expect(session.status(new Date(endedAt + DEFAULT_IDLE_THRESHOLD_MS + 1))).toBe('completed');
	});

	it('閾値を引数で変更できる', () => {
		expect(session.status(new Date(endedAt + 5 * MIN), 1 * MIN)).toBe('completed');
	});
});

describe('Session.create', () => {
	const props = {
		id: 's1',
		projectId: 'p1',
		cwd: null,
		startedAt: new Date(base),
		endedAt: new Date(base + MIN),
		inputTokens: 0,
		outputTokens: 0,
		messageCount: 1,
		models: [],
		activities: [],
	};

	it('保存済みの値から復元できる', () => {
		expect(Session.create(props).success).toBe(true);
	});

	it('終了が開始より前ならエラーにする', () => {
		expect(Session.create({ ...props, endedAt: new Date(base - 1) })).toEqual({
			success: false,
			error: 'ENDED_BEFORE_STARTED',
		});
	});

	it('トークン数・メッセージ数が負ならエラーにする', () => {
		expect(Session.create({ ...props, outputTokens: -1 })).toEqual({
			success: false,
			error: 'NEGATIVE_COUNT',
		});
	});
});
