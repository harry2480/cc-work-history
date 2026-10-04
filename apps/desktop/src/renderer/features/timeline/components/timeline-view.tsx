import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { formatDay, formatWeekRange } from '@/lib/utils/format';
import {
	addWeeks,
	daysOfWeek,
	isSameDay,
	parseDateInput,
	startOfWeek,
	weekPeriod,
} from '@/lib/utils/week';
import { useDisplaySettingsStore } from '@/stores/display-settings-store';
import { useTimelineStore } from '@/stores/timeline-store';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useTimeline } from '../api/use-timeline';
import { useTimelineZoom } from '../hooks/use-timeline-zoom';
import { colorGroupOf, legendOf } from '../utils/color-by';
import { assignLanes, toBarSegments } from '../utils/layout';
import { MAX_ZOOM, MIN_ZOOM, formatHourMark, hourMarkInterval, hourMarks } from '../utils/zoom';
import { ColorBySwitch } from './color-by-switch';
import { ColorLegend } from './color-legend';
import { SessionBar } from './session-bar';

/** 左端に固定する日付の列の幅（px） */
const LABEL_WIDTH = 88;
/** 段 1 つ分の高さ（px）と、日の行の最小の高さ */
const LANE_HEIGHT = 14;
const MIN_ROW_HEIGHT = 48;

export function TimelineView() {
	const weekStart = useTimelineStore((s) => s.weekStart);
	const setWeekStart = useTimelineStore((s) => s.setWeekStart);
	const selectedSessionId = useTimelineStore((s) => s.selectedSessionId);
	const selectSession = useTimelineStore((s) => s.selectSession);
	const colorBy = useDisplaySettingsStore((s) => s.colorBy);
	const colorOverrides = useDisplaySettingsStore((s) => s.colorOverrides);
	const { data, loading, error } = useTimeline(weekStart);
	const legend = useMemo(
		() => legendOf(data?.sessions ?? [], colorBy, colorOverrides),
		[data, colorBy, colorOverrides],
	);
	const days = useMemo(() => daysOfWeek(weekStart), [weekStart]);
	const today = new Date();
	const scrollRef = useRef<HTMLDivElement>(null);
	const zoom = useTimelineZoom({ scrollRef, labelWidth: LABEL_WIDTH });
	const marks = hourMarks(zoom.zoom);
	const gridInterval = `${(hourMarkInterval(zoom.zoom) / 24) * 100}%`;
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
			<header className="flex flex-wrap items-center gap-2">
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
				<Input
					type="date"
					aria-label="日付を指定して移動"
					className="h-9 w-40"
					onChange={(e) => {
						const date = parseDateInput(e.target.value);
						if (date) setWeekStart(startOfWeek(date));
					}}
				/>
				<h2 className="ml-2 whitespace-nowrap text-lg font-bold">
					{formatWeekRange(weekStart, weekPeriod(weekStart).to)}
				</h2>
				{loading && <span className="text-xs text-muted-foreground">読み込み中…</span>}
				<div className="ml-auto flex flex-wrap items-center gap-3">
					<div className="flex items-center gap-1">
						<Button
							variant="outline"
							size="icon"
							aria-label="縮小"
							disabled={zoom.zoom <= MIN_ZOOM}
							onClick={zoom.zoomOut}
						>
							<ZoomOut />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							aria-label="ズームを元に戻す"
							className="w-14"
							onClick={zoom.reset}
						>
							{Math.round(zoom.zoom * 100)}%
						</Button>
						<Button
							variant="outline"
							size="icon"
							aria-label="拡大"
							disabled={zoom.zoom >= MAX_ZOOM}
							onClick={zoom.zoomIn}
						>
							<ZoomIn />
						</Button>
					</div>
					<ColorBySwitch />
				</div>
			</header>
			<ColorLegend groups={legend} colorBy={colorBy} />

			{error && (
				<p role="alert" className="text-sm text-destructive">
					タイムラインを読み込めませんでした: {error}
				</p>
			)}

			{/* 時間軸の幅を zoom 倍に広げ、横スクロールでパンする。バーの位置は % なので時刻とずれない */}
			<div ref={scrollRef} data-testid="timeline-scroll" className="min-w-0 overflow-x-auto">
				<div
					className="grid text-xs"
					style={{
						gridTemplateColumns: `${LABEL_WIDTH}px 1fr`,
						width: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px) * ${zoom.zoom})`,
					}}
				>
					<div className="sticky left-0 z-10 bg-background" />
					<div className="relative h-5 text-muted-foreground">
						{marks.map((hour) => (
							<span key={hour} className="absolute" style={{ left: `${(hour / 24) * 100}%` }}>
								{formatHourMark(hour)}
							</span>
						))}
					</div>
					{days.map((day, dayIndex) => (
						<div key={day.getTime()} className="contents">
							<div
								className={cn(
									'sticky left-0 z-10 flex items-center border-t bg-background pr-2',
									isSameDay(day, today) && 'font-bold text-primary',
								)}
							>
								{formatDay(day)}
							</div>
							<div
								className="relative border-t bg-[repeating-linear-gradient(to_right,var(--border)_0_1px,transparent_1px_var(--grid-interval))] py-1"
								style={
									{
										'--grid-interval': gridInterval,
										height: Math.max(
											MIN_ROW_HEIGHT,
											(barsByDay[dayIndex]?.laneCount ?? 1) * LANE_HEIGHT + 8,
										),
									} as React.CSSProperties
								}
							>
								{barsByDay[dayIndex]?.bars.map((bar) => (
									<SessionBar
										key={bar.key}
										session={bar.session}
										segment={bar.segment}
										activity={bar.activity}
										lane={bar.lane}
										laneCount={barsByDay[dayIndex]?.laneCount ?? 1}
										tooltipAbove={dayIndex >= days.length - 2}
										color={colorGroupOf(bar.session, colorBy, colorOverrides).color}
										isSelected={bar.session.id === selectedSessionId}
										onSelect={selectSession}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			</div>

			{data && data.sessions.length === 0 && !loading && (
				<p className="text-sm text-muted-foreground">この週に該当するセッションはありません。</p>
			)}
		</div>
	);
}
