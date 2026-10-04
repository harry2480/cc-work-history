/** 色分けに使うパレット。globals.css の --project-color-N（ライト／ダークで値が変わる） */
export const PALETTE_SIZE = 10;

/** パレットの番号（1〜PALETTE_SIZE）の色 */
export function paletteColorAt(index: number): string {
	return `var(--project-color-${index})`;
}

/** プロジェクト ID やタグ名などのキーから、毎回同じ番号を選ぶ */
function paletteIndexOf(key: string): number {
	let hash = 0;
	for (const char of key) {
		hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
	}
	return (hash % PALETTE_SIZE) + 1;
}

/** ユーザーが選んだ番号があればその色、なければキーから自動で選んだ色 */
export function paletteColor(key: string, override?: number): string {
	const valid =
		override !== undefined &&
		Number.isInteger(override) &&
		override >= 1 &&
		override <= PALETTE_SIZE;
	return paletteColorAt(valid ? override : paletteIndexOf(key));
}

/** 該当なし（タグのないセッションなど）の色 */
export const NEUTRAL_COLOR = 'var(--muted-foreground)';

/** ステータスごとの色 */
export const STATUS_COLORS = {
	active: 'var(--primary)',
	completed: 'var(--project-color-8)',
} as const;
