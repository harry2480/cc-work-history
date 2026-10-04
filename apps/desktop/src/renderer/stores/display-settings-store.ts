import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** タイムラインの色分けの基準 */
export type ColorBy = 'project' | 'tag' | 'status';

/** テーマ。system は OS の設定に従う */
export type Theme = 'light' | 'dark' | 'system';

/**
 * ユーザーが選んだ色（パレットの番号 1〜PALETTE_SIZE）。
 * プロジェクトは ID、タグは小文字にした名前をキーにする。指定がなければ自動で選ぶ
 */
export type ColorOverrides = {
	projects: Record<string, number>;
	tags: Record<string, number>;
};

type DisplaySettingsState = {
	colorBy: ColorBy;
	theme: Theme;
	colorOverrides: ColorOverrides;
	setColorBy: (colorBy: ColorBy) => void;
	setTheme: (theme: Theme) => void;
	/** index が null なら自動に戻す */
	setProjectColor: (projectId: string, index: number | null) => void;
	setTagColor: (tagName: string, index: number | null) => void;
};

function withOverride(
	record: Record<string, number>,
	key: string,
	index: number | null,
): Record<string, number> {
	const { [key]: _removed, ...rest } = record;
	return index === null ? rest : { ...rest, [key]: index };
}

const COLOR_BY_VALUES: readonly ColorBy[] = ['project', 'tag', 'status'];
const THEME_VALUES: readonly Theme[] = ['light', 'dark', 'system'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeIndexes(value: unknown): Record<string, number> {
	if (!isRecord(value)) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, number] => Number.isInteger(entry[1])),
	);
}

/** localStorage から読んだ値のうち、正しい項目だけを取り出す */
export function sanitize(persisted: unknown): Partial<DisplaySettingsState> {
	if (!isRecord(persisted)) return {};
	const result: Partial<DisplaySettingsState> = {};
	if (COLOR_BY_VALUES.includes(persisted.colorBy as ColorBy)) {
		result.colorBy = persisted.colorBy as ColorBy;
	}
	if (THEME_VALUES.includes(persisted.theme as Theme)) result.theme = persisted.theme as Theme;
	if (isRecord(persisted.colorOverrides)) {
		result.colorOverrides = {
			projects: sanitizeIndexes(persisted.colorOverrides.projects),
			tags: sanitizeIndexes(persisted.colorOverrides.tags),
		};
	}
	return result;
}

/** 表示の好み。renderer の localStorage に保存し、再起動後も保持する */
export const useDisplaySettingsStore = create<DisplaySettingsState>()(
	persist(
		(set) => ({
			colorBy: 'project',
			theme: 'system',
			colorOverrides: { projects: {}, tags: {} },
			setColorBy: (colorBy) => set({ colorBy }),
			setTheme: (theme) => set({ theme }),
			setProjectColor: (projectId, index) =>
				set((s) => ({
					colorOverrides: {
						...s.colorOverrides,
						projects: withOverride(s.colorOverrides.projects, projectId, index),
					},
				})),
			setTagColor: (tagName, index) =>
				set((s) => ({
					colorOverrides: {
						...s.colorOverrides,
						tags: withOverride(s.colorOverrides.tags, tagName.toLowerCase(), index),
					},
				})),
		}),
		{
			name: 'cc-work-history:display-settings',
			storage: createJSONStorage(() => localStorage),
			version: 1,
			// 保存データが古い・壊れていても、項目ごとに既定値で補う
			merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
		},
	),
);
