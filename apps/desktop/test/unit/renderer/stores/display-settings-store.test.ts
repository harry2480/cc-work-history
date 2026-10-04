import { sanitize } from '@/stores/display-settings-store';
import { describe, expect, it } from 'vitest';

describe('display-settings-store の保存データの読み込み', () => {
	it('以前のバージョンの保存データ（色分けの基準だけ）はそのまま使い、残りは既定値にする', () => {
		expect(sanitize({ colorBy: 'tag' })).toEqual({ colorBy: 'tag' });
	});

	it('正しい項目だけを取り出す', () => {
		expect(
			sanitize({
				colorBy: 'unknown',
				theme: 'dark',
				colorOverrides: { projects: { p1: 3, p2: 'x' }, tags: null },
			}),
		).toEqual({ theme: 'dark', colorOverrides: { projects: { p1: 3 }, tags: {} } });
	});

	it('壊れた値は無視する', () => {
		expect(sanitize(null)).toEqual({});
		expect(sanitize('x')).toEqual({});
		expect(sanitize({ colorOverrides: [] })).toEqual({});
	});
});
