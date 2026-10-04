import { describe, expect, it } from 'vitest';
import { SessionResult } from '../../../../../../src/main/backend/domain/models/session-result.model';

const dates = { sessionEndedAt: new Date(1000), computedAt: new Date(2000) };

describe('SessionResult', () => {
	it('コミット数・変更ファイル数を持つ', () => {
		const result = SessionResult.create({
			kind: 'commits',
			commitCount: 2,
			changedFileCount: 3,
			...dates,
		});

		expect(result.success && result.value.value).toEqual({
			kind: 'commits',
			commitCount: 2,
			changedFileCount: 3,
		});
	});

	it.each([-1, 1.5, Number.NaN])('件数 %d は受け付けない', (count) => {
		expect(
			SessionResult.create({ kind: 'commits', commitCount: count, changedFileCount: 0, ...dates }),
		).toEqual({ success: false, error: 'NEGATIVE_COUNT' });
	});

	it('不正な日時は受け付けない', () => {
		expect(
			SessionResult.create({ kind: 'no_repository', ...dates, computedAt: new Date(Number.NaN) }),
		).toEqual({ success: false, error: 'INVALID_DATE' });
	});

	it('集計したときのセッションの終了日時と同じなら最新', () => {
		const result = SessionResult.create({ kind: 'no_repository', ...dates });
		if (!result.success) throw new Error(result.error);

		expect(result.value.isUpToDateWith(new Date(1000))).toBe(true);
		expect(result.value.isUpToDateWith(new Date(1001))).toBe(false);
	});
});
