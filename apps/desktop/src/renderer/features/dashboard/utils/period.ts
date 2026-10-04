import { addMonths, addWeeks, startOfMonth, startOfWeek } from '@/lib/utils/week';

export type PeriodKind = 'week' | 'month';

export type DashboardPeriod = {
	kind: PeriodKind;
	from: Date;
	to: Date;
};

/** その日を含む週（月曜〜日曜）または月 */
export function periodContaining(kind: PeriodKind, date: Date): DashboardPeriod {
	if (kind === 'week') {
		const from = startOfWeek(date);
		return { kind, from, to: addWeeks(from, 1) };
	}
	const from = startOfMonth(date);
	return { kind, from, to: addMonths(from, 1) };
}

/** 前後の期間 */
export function shiftPeriod(period: DashboardPeriod, steps: number): DashboardPeriod {
	const from =
		period.kind === 'week' ? addWeeks(period.from, steps) : addMonths(period.from, steps);
	return periodContaining(period.kind, from);
}

/** 例: 2026/9/28 〜 10/4、2026年10月 */
export function formatPeriod(period: DashboardPeriod): string {
	if (period.kind === 'month') {
		return `${period.from.getFullYear()}年${period.from.getMonth() + 1}月`;
	}
	const last = new Date(period.to.getTime() - 1);
	return `${period.from.getFullYear()}/${period.from.getMonth() + 1}/${period.from.getDate()} 〜 ${last.getMonth() + 1}/${last.getDate()}`;
}
