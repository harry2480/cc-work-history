import { projectColor } from '@/lib/config/palette';
import { describe, expect, it } from 'vitest';

describe('projectColor', () => {
	it('同じプロジェクトには毎回同じ色を返す', () => {
		expect(projectColor('-Users-me-repo-app')).toBe(projectColor('-Users-me-repo-app'));
	});

	it('CSS 変数のパレットから選ぶ', () => {
		expect(projectColor('a')).toMatch(/^var\(--project-color-(10|[1-9])\)$/);
	});

	it('プロジェクトが違えば色がばらける', () => {
		const colors = new Set(Array.from({ length: 30 }, (_, i) => projectColor(`project-${i}`)));
		expect(colors.size).toBeGreaterThan(5);
	});
});
