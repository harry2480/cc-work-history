import {
	MAX_ZOOM,
	MIN_ZOOM,
	anchoredScrollLeft,
	formatHourMark,
	hourMarks,
	zoomIn,
	zoomOut,
} from '@/features/timeline/utils/zoom';
import { describe, expect, it } from 'vitest';

describe('zoomIn / zoomOut', () => {
	it('段階に沿って拡大・縮小し、上限と下限を超えない', () => {
		expect(zoomIn(1)).toBe(1.5);
		expect(zoomOut(1.5)).toBe(1);
		expect(zoomIn(MAX_ZOOM)).toBe(MAX_ZOOM);
		expect(zoomOut(MIN_ZOOM)).toBe(MIN_ZOOM);
	});
});

describe('anchoredScrollLeft', () => {
	/** 時間軸の幅 W、ズーム z、スクロール s のとき、画面上の位置 x にある時刻（1 日に対する割合） */
	const timeAt = (x: number, s: number, z: number, W: number) => (s + x) / (W * z);

	it('ズームしても基準点の下の時刻が変わらない', () => {
		const W = 800;
		const cases = [
			{ scrollLeft: 0, anchorOffset: 400, fromZoom: 1, toZoom: 2 },
			{ scrollLeft: 1200, anchorOffset: 100, fromZoom: 3, toZoom: 6 },
			{ scrollLeft: 2400, anchorOffset: 700, fromZoom: 6, toZoom: 4 },
		];
		for (const c of cases) {
			const next = anchoredScrollLeft(c);
			expect(timeAt(c.anchorOffset, next, c.toZoom, W)).toBeCloseTo(
				timeAt(c.anchorOffset, c.scrollLeft, c.fromZoom, W),
			);
		}
	});

	it('スクロール位置は 0 より小さくしない', () => {
		expect(anchoredScrollLeft({ scrollLeft: 0, anchorOffset: 400, fromZoom: 2, toZoom: 1 })).toBe(
			0,
		);
	});

	it('ズーム後もバーの位置（% 指定）は時刻と一致する', () => {
		// 12:00 のバーは left: 50%。時間軸の幅が W * zoom に広がっても、時刻の位置と同じ割合になる
		const W = 800;
		for (const zoom of [1, 2, 6, 12]) {
			const barX = 0.5 * W * zoom;
			const noonX = (12 / 24) * W * zoom;
			expect(barX).toBe(noonX);
		}
	});
});

describe('hourMarks', () => {
	it('拡大するほど目盛りを細かくする', () => {
		expect(hourMarks(1)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
		expect(hourMarks(2)).toHaveLength(12);
		expect(hourMarks(4)).toHaveLength(24);
		expect(hourMarks(8)).toHaveLength(48);
	});

	it('目盛りを時:分で表示する', () => {
		expect(formatHourMark(9)).toBe('9:00');
		expect(formatHourMark(9.5)).toBe('9:30');
	});
});
