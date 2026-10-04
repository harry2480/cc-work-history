/** 色分けに使うパレット。globals.css の --project-color-N（ライト／ダークで値が変わる） */
const PALETTE_SIZE = 10;

/** プロジェクト ID やタグ名などのキーから、毎回同じ色を選ぶ */
export function paletteColor(key: string): string {
	let hash = 0;
	for (const char of key) {
		hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
	}
	return `var(--project-color-${(hash % PALETTE_SIZE) + 1})`;
}

/** 該当なし（タグのないセッションなど）の色 */
export const NEUTRAL_COLOR = 'var(--muted-foreground)';

/** ステータスごとの色 */
export const STATUS_COLORS = {
	active: 'var(--primary)',
	completed: 'var(--project-color-8)',
} as const;
