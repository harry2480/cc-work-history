import { resolveTheme } from '@/lib/utils/theme';
import { describe, expect, it } from 'vitest';

describe('resolveTheme', () => {
	it('ライト・ダークを選んだらそのまま使う', () => {
		expect(resolveTheme('light', true)).toBe('light');
		expect(resolveTheme('dark', false)).toBe('dark');
	});

	it('OS に従う場合は OS の設定で決める', () => {
		expect(resolveTheme('system', true)).toBe('dark');
		expect(resolveTheme('system', false)).toBe('light');
	});
});
