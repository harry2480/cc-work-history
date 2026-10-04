import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** タイムラインの色分けの基準 */
export type ColorBy = 'project' | 'tag' | 'status';

type DisplaySettingsState = {
	colorBy: ColorBy;
	setColorBy: (colorBy: ColorBy) => void;
};

/** 表示の好み。renderer の localStorage に保存し、再起動後も保持する */
export const useDisplaySettingsStore = create<DisplaySettingsState>()(
	persist(
		(set) => ({
			colorBy: 'project',
			setColorBy: (colorBy) => set({ colorBy }),
		}),
		{ name: 'cc-work-history:display-settings', storage: createJSONStorage(() => localStorage) },
	),
);
