import { startOfWeek } from '@/lib/utils/week';
import { create } from 'zustand';

type TimelineState = {
	/** 表示中の週の月曜 0:00（ローカル時刻） */
	weekStart: Date;
	setWeekStart: (weekStart: Date) => void;
	/** 詳細パネルに表示するセッション */
	selectedSessionId: string | null;
	selectSession: (sessionId: string | null) => void;
	/** renderer からデータを変更したら増やし、表示中のデータを取り直させる */
	dataVersion: number;
	notifyDataChanged: () => void;
	/** 概要を生成中のセッション（詳細パネルを開き直しても、生成中は編集させないため） */
	generatingSummaryIds: readonly string[];
	setGeneratingSummary: (sessionId: string, generating: boolean) => void;
	/** タイムラインの横方向の拡大率 */
	zoom: number;
	setZoom: (zoom: number) => void;
};

export const useTimelineStore = create<TimelineState>((set) => ({
	weekStart: startOfWeek(new Date()),
	setWeekStart: (weekStart) => set({ weekStart }),
	selectedSessionId: null,
	selectSession: (selectedSessionId) => set({ selectedSessionId }),
	dataVersion: 0,
	notifyDataChanged: () => set((state) => ({ dataVersion: state.dataVersion + 1 })),
	generatingSummaryIds: [],
	setGeneratingSummary: (sessionId, generating) =>
		set((state) => ({
			generatingSummaryIds: generating
				? [...new Set([...state.generatingSummaryIds, sessionId])]
				: state.generatingSummaryIds.filter((id) => id !== sessionId),
		})),
	zoom: 1,
	setZoom: (zoom) => set({ zoom }),
}));
