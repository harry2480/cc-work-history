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
	zoom: 1,
	setZoom: (zoom) => set({ zoom }),
}));
