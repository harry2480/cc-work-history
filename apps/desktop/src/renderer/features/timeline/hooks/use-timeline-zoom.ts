import { useTimelineStore } from '@/stores/timeline-store';
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { MIN_ZOOM, anchoredScrollLeft, zoomIn, zoomOut } from '../utils/zoom';

type Options = {
	/** 横スクロールするタイムラインの要素 */
	scrollRef: RefObject<HTMLElement | null>;
	/** 左端に固定した日付の列の幅（px） */
	labelWidth: number;
};

/**
 * タイムラインのズーム。ボタン・キーボード（+ / - / 0）・Ctrl/⌘ + ホイール（ピンチ）で拡大縮小し、
 * 基準点（ホイールならマウスの位置、それ以外は表示の中央）の下の時刻が動かないようにスクロールを補正する
 */
/** ズームを 1 段階動かすのに必要な deltaY の量（マウスホイールは 1 回で 100 前後） */
const WHEEL_STEP = 50;

export function useTimelineZoom({ scrollRef, labelWidth }: Options) {
	const zoom = useTimelineStore((s) => s.zoom);
	const setZoom = useTimelineStore((s) => s.setZoom);
	/** ズーム後に適用するスクロール位置 */
	const pendingScroll = useRef<number | null>(null);

	const changeZoom = useCallback(
		(next: number, anchorClientX?: number) => {
			const el = scrollRef.current;
			const current = useTimelineStore.getState().zoom;
			if (next === current) return;
			if (el) {
				const rect = el.getBoundingClientRect();
				const timeAreaWidth = rect.width - labelWidth;
				const anchorOffset =
					anchorClientX === undefined
						? timeAreaWidth / 2
						: Math.min(Math.max(anchorClientX - rect.left - labelWidth, 0), timeAreaWidth);
				pendingScroll.current = anchoredScrollLeft({
					scrollLeft: el.scrollLeft,
					anchorOffset,
					fromZoom: current,
					toZoom: next,
				});
			}
			setZoom(next);
		},
		[scrollRef, labelWidth, setZoom],
	);

	// 幅が変わった後（描画後）にスクロール位置を合わせる
	// biome-ignore lint/correctness/useExhaustiveDependencies: zoom が変わったときに適用する
	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (el && pendingScroll.current !== null) el.scrollLeft = pendingScroll.current;
		pendingScroll.current = null;
	}, [zoom, scrollRef]);

	// Ctrl/⌘ + ホイール（トラックパッドのピンチを含む）。既定のスクロールを止めるため passive: false で登録する
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		// トラックパッドのピンチは小さな deltaY を連続して送るので、一定量たまったら 1 段階動かす
		let accumulated = 0;
		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) return;
			event.preventDefault();
			if (event.deltaY === 0) return;
			accumulated += event.deltaY;
			if (Math.abs(accumulated) < WHEEL_STEP) return;
			const current = useTimelineStore.getState().zoom;
			changeZoom(accumulated < 0 ? zoomIn(current) : zoomOut(current), event.clientX);
			accumulated = 0;
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	}, [scrollRef, changeZoom]);

	// キーボード（入力欄にいるときは使わない）
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
			const current = useTimelineStore.getState().zoom;
			if (event.key === '+' || event.key === '=') changeZoom(zoomIn(current));
			else if (event.key === '-') changeZoom(zoomOut(current));
			else if (event.key === '0') changeZoom(MIN_ZOOM);
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [changeZoom]);

	return {
		zoom,
		zoomIn: () => changeZoom(zoomIn(zoom)),
		zoomOut: () => changeZoom(zoomOut(zoom)),
		reset: () => changeZoom(MIN_ZOOM),
	};
}

function isEditable(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
	);
}
