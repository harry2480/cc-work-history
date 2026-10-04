/** 入力欄の文字列を閾値（分）にする。範囲外・整数でない値は null */
export function parseIdleThresholdInput(input: string, min: number, max: number): number | null {
	if (!/^\d+$/.test(input.trim())) return null;
	const minutes = Number(input.trim());
	return minutes >= min && minutes <= max ? minutes : null;
}
