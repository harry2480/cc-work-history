import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatDay, formatWeekRange } from '@/lib/utils/format';
import { useTimelineStore } from '@/stores/timeline-store';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useTimeline } from '../api/use-timeline';
import { assignLanes, toBarSegments } from '../utils/layout';
import { addWeeks, daysOfWeek, isSameDay, startOfWeek, weekPeriod } from '../utils/week';
import { SessionBar } from './session-bar';

const HOUR_MARKS = [0, 3, 6, 9, 12, 15, 18, 21];
/** 段 1 つ分の高さ（px）と、日の行の最小の高さ */
const LANE_HEIGHT = 14;
const MIN_ROW_HEIGHT = 48;

export function TimelineView() {
	const weekStart = useTimelineStore((s) => s.weekStart);
	const setWeekStart = useTimelineStore((s) => s.setWeekStart);
	const selectedSessionId = useTimelineStore((s) => s.selectedSessionId);
	const selectSession = useTimelineStore((s) => s.selectSession);
	const { data, loading, error } = useTimeline(weekStart);
	const days = useMemo(() => daysOfWeek(weekStart), [weekStart]);
	const today = new Date();
	const isThisWeek = weekStart.getTime() === startOfWeek(today).getTime();

	const barsByDay = useMemo(() => {
		const bars = (data?.sessions ?? []).flatMap((session) =>
			session.activities.flatMap((a, activityIndex) => {
				const activity = { startedAt: new Date(a.startedAt), endedAt: new Date(a.endedAt) };
				return toBarSegments(activity, days).map((segment) => ({
					key: `${session.id}-${activityIndex}-${segment.dayIndex}`,
					session,
					activity,
					segment,
				}));
			}),
		);
		// 並行して動いていたセッションが重ならないよう、日ごとに段を分ける
		return days.map((_, dayIndex) => {
			const dayBars = bars.filter((bar) => bar.segment.dayIndex === dayIndex);
			const lanes = assignLanes(dayBars.map((bar) => bar.segment));
			return {
				bars: dayBars.map((bar, i) => ({ ...bar, lane: lanes[i] ?? 0 })),
				laneCount: Math.max(1, ...lanes.map((lane) => lane + 1)),
			};
		});
	}, [data, days]);

	return (
		<div className="flex flex-col gap-4">
			<header className="flex items-center gap-2">
				<Button
					variant="outline"
					size="icon"
					aria-label="前の週"
					onClick={() => setWeekStart(addWeeks(weekStart, -1))}
				>
					<ChevronLeft />
				</Button>
				<Button
					variant="outline"
					size="icon"
					aria-label="次の週"
					onClick={() => setWeekStart(addWeeks(weekStart, 1))}
				>
					<ChevronRight />
				</Button>
				<Button
					variant="outline"
					disabled={isThisWeek}
					onClick={() => setWeekStart(startOfWeek(today))}
				>
					今週
				</Button>
				<h2 className="ml-2 text-lg font-bold">
					{formatWeekRange(weekStart, weekPeriod(weekStart).to)}
				</h2>
				{loading && <span className="text-xs text-muted-foreground">読み込み中…</span>}
			</header>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					タイムラインを読み込めませんでした: {error}
				</p>
			)}

			<div className="grid grid-cols-[5.5rem_1fr] text-xs">
				<div />
				<div className="relative h-5 text-muted-foreground">
					{HOUR_MARKS.map((hour) => (
						<span key={hour} className="absolute" style={{ left: `${(hour / 24) * 100}%` }}>
							{hour}:00
						</span>
					))}
				</div>
				{days.map((day, dayIndex) => (
					<div key={day.getTime()} className="contents">
						<div
							className={cn(
								'flex items-center border-t pr-2',
								isSameDay(day, today) && 'font-bold text-primary',
							)}
						>
							{formatDay(day)}
						</div>
						<div
							className="relative border-t bg-[repeating-linear-gradient(to_right,var(--border)_0_1px,transparent_1px_12.5%)] py-1"
							style={{
								height: Math.max(
									MIN_ROW_HEIGHT,
									(barsByDay[dayIndex]?.laneCount ?? 1) * LANE_HEIGHT + 8,
								),
							}}
						>
							{barsByDay[dayIndex]?.bars.map((bar) => (
								<SessionBar
									key={bar.key}
									session={bar.session}
									segment={bar.segment}
									activity={bar.activity}
									lane={bar.lane}
									laneCount={barsByDay[dayIndex]?.laneCount ?? 1}
									isSelected={bar.session.id === selectedSessionId}
									onSelect={selectSession}
								/>
							))}
						</div>
					</div>
				))}
			</div>

			{data && data.sessions.length === 0 && !loading && (
				<p className="text-sm text-muted-foreground">この週のセッションはありません。</p>
			)}
		</div>
	);
}
