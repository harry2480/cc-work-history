import { resolveTheme } from '@/lib/utils/theme';
import { useDisplaySettingsStore } from '@/stores/display-settings-store';
import { useLayoutEffect } from 'react';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/** 設定のテーマを html 要素の .dark クラスに反映する。OS に従う場合は OS の切り替えにも追従する */
export function useApplyTheme(): void {
	const theme = useDisplaySettingsStore((s) => s.theme);

	// 描画前に反映し、起動時に一瞬だけ別のテーマで表示されないようにする
	useLayoutEffect(() => {
		const media = window.matchMedia(DARK_QUERY);
		const apply = () => {
			document.documentElement.classList.toggle(
				'dark',
				resolveTheme(theme, media.matches) === 'dark',
			);
		};
		apply();
		media.addEventListener('change', apply);
		return () => media.removeEventListener('change', apply);
	}, [theme]);
}
