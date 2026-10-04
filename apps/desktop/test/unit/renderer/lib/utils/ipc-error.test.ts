import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { describe, expect, it } from 'vitest';

describe('ipcErrorMessage', () => {
	it('Electron が付ける前置きとエラー名を取り除く', () => {
		expect(
			ipcErrorMessage(
				new Error(
					"Error invoking remote method 'settings:update-idle-threshold': InvalidAppSettingsError: 閾値が不正です",
				),
			),
		).toBe('閾値が不正です');
	});

	it('前置きがなければそのまま返す', () => {
		expect(ipcErrorMessage(new Error('boom'))).toBe('boom');
		expect(ipcErrorMessage('text')).toBe('text');
	});
});
