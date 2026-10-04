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
