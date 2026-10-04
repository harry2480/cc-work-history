import { type RefObject, useEffect, useRef, useState } from 'react';

/** 画面に入る少し手前で true にする（スクロール方向に、この距離だけ先読みする） */
const ROOT_MARGIN = '800px 0px';

/**
 * 要素がスクロール領域（root）の表示範囲の近くに来たら true を返す。一度 true になったら戻さない。
 * IntersectionObserver がない環境では最初から true
 */
export function useNearViewport<T extends Element>(
	rootRef: RefObject<Element | null>,
): [RefObject<T>, boolean] {
	const ref = useRef<T>(null);
	const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

	useEffect(() => {
		const element = ref.current;
		if (near || !element) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) setNear(true);
			},
			{ root: rootRef.current, rootMargin: ROOT_MARGIN },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [near, rootRef]);

	return [ref, near];
}
