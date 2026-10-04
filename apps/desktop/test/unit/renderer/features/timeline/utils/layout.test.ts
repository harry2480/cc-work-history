import {
	MIN_BAR_WIDTH_PERCENT,
	assignLanes,
	toBarSegments,
} from '@/features/timeline/utils/layout';
import { daysOfWeek } from '@/lib/utils/week';
import { describe, expect, it } from 'vitest';

const local = (d: number, h = 0, min = 0) => new Date(2026, 8, d, h, min);
// 2026-09-28（月）〜 10-04（日）
const days = daysOfWeek(local(28));

describe('toBarSegments', () => {
	it('時刻を、その日の行の中の位置（%）に変換する', () => {
		const segments = toBarSegments({ startedAt: local(29, 6), endedAt: local(29, 12) }, days);

		expect(segments).toEqual([{ dayIndex: 1, leftPercent: 25, widthPercent: 25 }]);
	});

	it('日付をまたぐ区間は日ごとに分ける', () => {
		const segments = toBarSegments({ startedAt: local(28, 18), endedAt: local(29, 6) }, days);

		expect(segments).toEqual([
			{ dayIndex: 0, leftPercent: 75, widthPercent: 25 },
			{ dayIndex: 1, leftPercent: 0, widthPercent: 25 },
		]);
	});

	it('週の外にはみ出した部分は切り取る', () => {
		const segments = toBarSegments({ startedAt: local(27, 18), endedAt: local(28, 6) }, days);

		expect(segments).toEqual([{ dayIndex: 0, leftPercent: 0, widthPercent: 25 }]);
	});

	it('長さ 0 の区間は最小幅で、その瞬間を含む日にだけ置く', () => {
		const segments = toBarSegments({ startedAt: local(30, 0), endedAt: local(30, 0) }, days);

		expect(segments).toEqual([
			{ dayIndex: 2, leftPercent: 0, widthPercent: MIN_BAR_WIDTH_PERCENT },
		]);
	});

	it('日の終わり近くの短い区間は、はみ出さないよう左に寄せる', () => {
		const [segment] = toBarSegments(
			{ startedAt: local(30, 23, 59), endedAt: local(30, 23, 59) },
			days,
		);

		expect(segment?.leftPercent).toBeCloseTo(100 - MIN_BAR_WIDTH_PERCENT);
		expect(segment?.widthPercent).toBe(MIN_BAR_WIDTH_PERCENT);
	});

	it('週と重ならない区間は空', () => {
		expect(toBarSegments({ startedAt: local(20, 0), endedAt: local(20, 5) }, days)).toEqual([]);
	});
});

describe('assignLanes', () => {
	const seg = (leftPercent: number, widthPercent: number) => ({ leftPercent, widthPercent });

	it('重ならないバーは同じ段に置く', () => {
		expect(assignLanes([seg(0, 10), seg(10, 10), seg(30, 5)])).toEqual([0, 0, 0]);
	});

	it('重なるバーは空いている一番上の段に置く', () => {
		// 0-20 / 5-15 / 10-30 / 21-25
		expect(assignLanes([seg(0, 20), seg(5, 10), seg(10, 20), seg(21, 4)])).toEqual([0, 1, 2, 0]);
	});

	it('入力の順番に関係なく、左から順に割り当てた結果を入力順で返す', () => {
		expect(assignLanes([seg(5, 10), seg(0, 20)])).toEqual([1, 0]);
	});

	it('空なら空', () => {
		expect(assignLanes([])).toEqual([]);
	});
});
