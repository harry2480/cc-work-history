/** ズーム倍率の段階（1 = 1 日がタイムラインの幅ちょうど） */
export const ZOOM_LEVELS = [1, 1.5, 2, 3, 4, 6, 8, 12] as const;
export const MIN_ZOOM = ZOOM_LEVELS[0];
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/** 次に大きい倍率（上限ならそのまま） */
export function zoomIn(zoom: number): number {
	return ZOOM_LEVELS.find((level) => level > zoom) ?? MAX_ZOOM;
}

/** 次に小さい倍率（下限ならそのまま） */
export function zoomOut(zoom: number): number {
	return [...ZOOM_LEVELS].reverse().find((level) => level < zoom) ?? MIN_ZOOM;
}

/**
 * ズームしても、基準点（マウスの位置など）の下の時刻が同じ場所に留まるスクロール位置。
 * anchorOffset は時間軸の左端から基準点までの、画面上の距離（px）
 */
export function anchoredScrollLeft(params: {
	scrollLeft: number;
	anchorOffset: number;
	fromZoom: number;
	toZoom: number;
}): number {
	const { scrollLeft, anchorOffset, fromZoom, toZoom } = params;
	const anchorInContent = scrollLeft + anchorOffset;
	return Math.max(0, (anchorInContent * toZoom) / fromZoom - anchorOffset);
}

/** 時刻の目盛りの間隔（時間）。拡大するほど細かくする */
export function hourMarkInterval(zoom: number): number {
	if (zoom < 1.5) return 3;
	if (zoom < 3) return 2;
	if (zoom < 6) return 1;
	return 0.5;
}

/** 目盛りを置く時刻（0 時からの時間） */
export function hourMarks(zoom: number): number[] {
	const interval = hourMarkInterval(zoom);
	return Array.from({ length: Math.round(24 / interval) }, (_, i) => i * interval);
}

/** 目盛りの表示（例: 9:00 / 9:30） */
export function formatHourMark(hour: number): string {
	const minutes = Math.round((hour % 1) * 60);
	return `${Math.floor(hour)}:${String(minutes).padStart(2, '0')}`;
}
