import { parseIdleThresholdInput } from '@/features/settings/utils/idle-threshold';
import { describe, expect, it } from 'vitest';

describe('parseIdleThresholdInput', () => {
	it('範囲内の整数を分として返す', () => {
		expect(parseIdleThresholdInput('45', 1, 240)).toBe(45);
		expect(parseIdleThresholdInput(' 1 ', 1, 240)).toBe(1);
		expect(parseIdleThresholdInput('240', 1, 240)).toBe(240);
	});

	it.each(['', '0', '241', '1.5', '-5', 'abc', '1e2'])('「%s」は null', (input) => {
		expect(parseIdleThresholdInput(input, 1, 240)).toBeNull();
	});
});
