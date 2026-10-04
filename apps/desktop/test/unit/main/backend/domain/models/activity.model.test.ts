import { describe, expect, it } from 'vitest';
import { Activity } from '../../../../../../src/main/backend/domain/models/activity.model';

const start = new Date('2026-10-01T09:00:00Z');
const props = {
	sessionId: 's1',
	startedAt: start,
	endedAt: new Date(start.getTime() + 60_000),
	messageCount: 2,
};

describe('Activity.create', () => {
	it('活動区間を生成し、長さを返す', () => {
		const result = Activity.create(props);

		expect(result.success && result.value.durationMs).toBe(60_000);
	});

	it('終了が開始より前ならエラーにする', () => {
		expect(Activity.create({ ...props, endedAt: new Date(start.getTime() - 1) })).toEqual({
			success: false,
			error: 'ENDED_BEFORE_STARTED',
		});
	});

	it('セッション ID が空ならエラーにする', () => {
		expect(Activity.create({ ...props, sessionId: '' })).toEqual({
			success: false,
			error: 'EMPTY_SESSION_ID',
		});
	});

	it('メッセージが 0 件ならエラーにする', () => {
		expect(Activity.create({ ...props, messageCount: 0 })).toEqual({
			success: false,
			error: 'NO_MESSAGES',
		});
	});
});
