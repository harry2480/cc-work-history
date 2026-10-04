import { describe, expect, it } from 'vitest';
import { AppSettings } from '../../../../../../src/main/backend/domain/models/app-settings.model';

describe('AppSettings', () => {
	it('既定の閾値は 30 分', () => {
		const settings = AppSettings.default();

		expect(settings.idleThresholdMinutes).toBe(30);
		expect(settings.idleThresholdMs).toBe(30 * 60_000);
	});

	it.each([1, 45, 240])('%i 分は受け付ける', (minutes) => {
		const settings = AppSettings.create({ idleThresholdMinutes: minutes });

		expect(settings.success && settings.value.idleThresholdMinutes).toBe(minutes);
	});

	it.each([0, 241, 1.5, Number.NaN, -10])('%d 分は受け付けない', (minutes) => {
		expect(AppSettings.create({ idleThresholdMinutes: minutes })).toEqual({
			success: false,
			error: 'INVALID_IDLE_THRESHOLD',
		});
	});
});
