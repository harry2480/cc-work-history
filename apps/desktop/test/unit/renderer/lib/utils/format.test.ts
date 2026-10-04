import { formatDuration, formatInteger, formatTokens } from '@/lib/utils/format';
import { describe, expect, it } from 'vitest';

describe('formatDuration', () => {
	it.each([
		[0, '1分未満'],
		[59_999, '1分未満'],
		[5 * 60_000, '5分'],
		[60 * 60_000, '1時間'],
		[95 * 60_000, '1時間 35分'],
	])('%i ミリ秒は %s', (ms, expected) => {
		expect(formatDuration(ms)).toBe(expected);
	});
});

describe('数値の表示', () => {
	it('整数は桁区切り、トークン数は短縮表記', () => {
		expect(formatInteger(1234567)).toBe('1,234,567');
		expect(formatTokens(130_000_000)).toBe('1.3億');
	});
});
