import type { Theme } from '@/stores/display-settings-store';

/** 実際に使うテーマ。system なら OS の設定（ダークモードかどうか）に従う */
export function resolveTheme(theme: Theme, prefersDark: boolean): 'light' | 'dark' {
	if (theme === 'system') return prefersDark ? 'dark' : 'light';
	return theme;
}
