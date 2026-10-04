import { paletteColor, paletteColorAt } from '@/lib/config/palette';
import { describe, expect, it } from 'vitest';

describe('paletteColor', () => {
	it('同じキーには毎回同じ色を返す', () => {
		expect(paletteColor('-Users-me-repo-app')).toBe(paletteColor('-Users-me-repo-app'));
	});

	it('CSS 変数のパレットから選ぶ', () => {
		expect(paletteColor('a')).toMatch(/^var\(--project-color-(10|[1-9])\)$/);
	});

	it('キーが違えば色がばらける', () => {
		const colors = new Set(Array.from({ length: 30 }, (_, i) => paletteColor(`project-${i}`)));
		expect(colors.size).toBeGreaterThan(5);
	});

	it('選んだ番号があればその色にする。範囲外の番号は無視する', () => {
		expect(paletteColor('a', 3)).toBe(paletteColorAt(3));
		expect(paletteColor('a', 0)).toBe(paletteColor('a'));
		expect(paletteColor('a', 11)).toBe(paletteColor('a'));
		expect(paletteColor('a', 1.5)).toBe(paletteColor('a'));
	});
});
