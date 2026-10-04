const timeFormat = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('ja-JP', {
	month: 'numeric',
	day: 'numeric',
	weekday: 'short',
});
const tokenFormat = new Intl.NumberFormat('ja-JP', {
	notation: 'compact',
	maximumFractionDigits: 1,
});

export function formatTime(date: Date): string {
	return timeFormat.format(date);
}

export function formatDay(date: Date): string {
	return dayFormat.format(date);
}

export function formatTokens(tokens: number): string {
	return tokenFormat.format(tokens);
}

/** 例: 2026/9/28 〜 10/4 */
export function formatWeekRange(weekStart: Date, weekEnd: Date): string {
	const last = new Date(weekEnd.getTime() - 1);
	return `${weekStart.getFullYear()}/${weekStart.getMonth() + 1}/${weekStart.getDate()} 〜 ${last.getMonth() + 1}/${last.getDate()}`;
}

const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
	year: 'numeric',
	month: 'numeric',
	day: 'numeric',
	weekday: 'short',
	hour: '2-digit',
	minute: '2-digit',
});
const integerFormat = new Intl.NumberFormat('ja-JP');

/** 例: 2026/10/1(木) 09:00 */
export function formatDateTime(date: Date): string {
	return dateTimeFormat.format(date);
}

/** 例: 12,345 */
export function formatInteger(value: number): string {
	return integerFormat.format(value);
}

/** 例: 1時間 23分 / 5分 / 1分未満 */
export function formatDuration(ms: number): string {
	const totalMinutes = Math.floor(ms / 60_000);
	if (totalMinutes < 1) return '1分未満';
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours === 0) return `${minutes}分`;
	return minutes === 0 ? `${hours}時間` : `${hours}時間 ${minutes}分`;
}

const shortDateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
	month: 'numeric',
	day: 'numeric',
	weekday: 'short',
	hour: '2-digit',
	minute: '2-digit',
});

/** 表など狭い場所用。例: 9/19(土) 22:24（今年でなければ先頭に年を付ける） */
export function formatShortDateTime(date: Date, now = new Date()): string {
	const text = shortDateTimeFormat.format(date);
	return date.getFullYear() === now.getFullYear() ? text : `${date.getFullYear()}/${text}`;
}
