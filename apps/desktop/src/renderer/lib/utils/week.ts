export const DAY_MS = 24 * 60 * 60 * 1000;

/** ローカル時刻で、その日を含む週の月曜 0:00 */
export function startOfWeek(date: Date): Date {
	const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const daysSinceMonday = (start.getDay() + 6) % 7;
	start.setDate(start.getDate() - daysSinceMonday);
	return start;
}

/** 週の開始日から weeks 週ずらした月曜 0:00（夏時間をまたいでもローカルの 0:00 を保つ） */
export function addWeeks(weekStart: Date, weeks: number): Date {
	const next = new Date(weekStart);
	next.setDate(next.getDate() + weeks * 7);
	return next;
}

/** 週の 7 日分の 0:00 */
export function daysOfWeek(weekStart: Date): Date[] {
	return Array.from({ length: 7 }, (_, i) => {
		const day = new Date(weekStart);
		day.setDate(day.getDate() + i);
		return day;
	});
}

/** 週の期間（月曜 0:00 以上、翌週月曜 0:00 未満） */
export function weekPeriod(weekStart: Date): { from: Date; to: Date } {
	return { from: weekStart, to: addWeeks(weekStart, 1) };
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** 期間 [from, to) と [otherFrom, otherTo] が重なるか（区間の終わりは含む） */
export function overlaps(
	period: { from: Date; to: Date },
	other: { from: Date; to: Date },
): boolean {
	return other.from < period.to && other.to >= period.from;
}

/** `<input type="date">` の値（YYYY-MM-DD）をローカル時刻の 0:00 にする。不正なら null */
export function parseDateInput(value: string): Date | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(year, month - 1, day);
	return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** その日を含む月の 1 日 0:00（ローカル時刻） */
export function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** 月の開始日から months か月ずらした 1 日 0:00 */
export function addMonths(monthStart: Date, months: number): Date {
	return new Date(monthStart.getFullYear(), monthStart.getMonth() + months, 1);
}
