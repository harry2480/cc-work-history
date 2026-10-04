import { startOfWeek } from '@/features/timeline/utils/week';
import { create } from 'zustand';

type TimelineState = {
	/** 表示中の週の月曜 0:00（ローカル時刻） */
	weekStart: Date;
	setWeekStart: (weekStart: Date) => void;
};

export const useTimelineStore = create<TimelineState>((set) => ({
	weekStart: startOfWeek(new Date()),
	setWeekStart: (weekStart) => set({ weekStart }),
}));
