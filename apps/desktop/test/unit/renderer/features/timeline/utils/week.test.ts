import {
	addWeeks,
	daysOfWeek,
	isSameDay,
	overlaps,
	parseDateInput,
	startOfWeek,
	weekPeriod,
} from '@/features/timeline/utils/week';
import { describe, expect, it } from 'vitest';

// ローカル時刻で組み立てて、実行環境のタイムゾーンに依存しないようにする
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('startOfWeek', () => {
	it('その日を含む週の月曜 0:00 を返す', () => {
		expect(startOfWeek(local(2026, 10, 1, 15, 30))).toEqual(local(2026, 9, 28));
		expect(startOfWeek(local(2026, 9, 28))).toEqual(local(2026, 9, 28));
	});

	it('日曜はその前の月曜からの週に含める', () => {
		expect(startOfWeek(local(2026, 10, 4, 23, 59))).toEqual(local(2026, 9, 28));
	});
});

describe('週の計算', () => {
	const weekStart = local(2026, 9, 28);

	it('addWeeks で前後の週の月曜 0:00 を返す', () => {
		expect(addWeeks(weekStart, 1)).toEqual(local(2026, 10, 5));
		expect(addWeeks(weekStart, -1)).toEqual(local(2026, 9, 21));
	});

	it('daysOfWeek で 7 日分の 0:00 を返す（月をまたぐ）', () => {
		const days = daysOfWeek(weekStart);

		expect(days).toHaveLength(7);
		expect(days[0]).toEqual(local(2026, 9, 28));
		expect(days[6]).toEqual(local(2026, 10, 4));
	});

	it('weekPeriod は月曜 0:00 から翌週月曜 0:00 まで', () => {
		expect(weekPeriod(weekStart)).toEqual({ from: local(2026, 9, 28), to: local(2026, 10, 5) });
	});

	it('isSameDay は日付だけを比べる', () => {
		expect(isSameDay(local(2026, 10, 1, 0, 0), local(2026, 10, 1, 23, 59))).toBe(true);
		expect(isSameDay(local(2026, 10, 1), local(2026, 10, 2))).toBe(false);
	});
});

describe('overlaps', () => {
	const period = { from: local(2026, 9, 28), to: local(2026, 10, 5) };

	it('期間と重なる・接する区間を判定する', () => {
		expect(overlaps(period, { from: local(2026, 9, 27), to: local(2026, 9, 28) })).toBe(true);
		expect(overlaps(period, { from: local(2026, 10, 5), to: local(2026, 10, 6) })).toBe(false);
		expect(overlaps(period, { from: local(2026, 9, 20), to: local(2026, 9, 21) })).toBe(false);
	});
});

describe('parseDateInput', () => {
	it('YYYY-MM-DD をローカル時刻の 0:00 にし、不正な値は null', () => {
		expect(parseDateInput('2026-10-01')).toEqual(local(2026, 10, 1));
		expect(parseDateInput('2026-02-30')).toBeNull();
		expect(parseDateInput('')).toBeNull();
	});
});
