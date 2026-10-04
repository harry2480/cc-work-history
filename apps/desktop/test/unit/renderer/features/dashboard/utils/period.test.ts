import { formatPeriod, periodContaining, shiftPeriod } from '@/features/dashboard/utils/period';
import { describe, expect, it } from 'vitest';

const local = (m: number, d: number) => new Date(2026, m - 1, d);

describe('dashboard の期間', () => {
	it('その日を含む週（月曜〜）と月を返す', () => {
		expect(periodContaining('week', local(10, 1))).toEqual({
			kind: 'week',
			from: local(9, 28),
			to: local(10, 5),
		});
		expect(periodContaining('month', local(10, 15))).toEqual({
			kind: 'month',
			from: local(10, 1),
			to: local(11, 1),
		});
	});

	it('前後の期間に移動する（年をまたぐ）', () => {
		expect(shiftPeriod(periodContaining('month', local(12, 10)), 1).from).toEqual(
			new Date(2027, 0, 1),
		);
		expect(shiftPeriod(periodContaining('week', local(10, 1)), -1).from).toEqual(local(9, 21));
	});

	it('期間を表示用の文字列にする', () => {
		expect(formatPeriod(periodContaining('week', local(10, 1)))).toBe('2026/9/28 〜 10/4');
		expect(formatPeriod(periodContaining('month', local(10, 1)))).toBe('2026年10月');
	});
});
