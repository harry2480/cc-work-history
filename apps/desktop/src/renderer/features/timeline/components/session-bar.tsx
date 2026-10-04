import { cn } from '@/lib/utils/cn';
import { formatTime, formatTokens } from '@/lib/utils/format';
import type { TimelineSessionDto } from '@shared/ipc-contract';
import type { BarSegment } from '../utils/layout';

type Props = {
	session: TimelineSessionDto;
	segment: BarSegment;
	activity: { startedAt: Date; endedAt: Date };
	/** 並行するバーを重ねないための段番号と、その日の段の数 */
	lane: number;
	laneCount: number;
	/** バーの色（CSS の色の値） */
	color: string;
	isSelected: boolean;
	onSelect: (sessionId: string) => void;
	/** 下の方の行では、スクロール領域で切れないようツールチップを上に出す */
	tooltipAbove?: boolean;
};

/** 活動区間 1 つ分のバー。位置と幅だけを style で指定する（docs/スタイルガイド.md） */
export function SessionBar({
	session,
	segment,
	activity,
	lane,
	laneCount,
	color,
	isSelected,
	onSelect,
	tooltipAbove = false,
}: Props) {
	const isActive = session.status === 'active';
	const label = `${session.project.name} ${formatTime(activity.startedAt)}〜${formatTime(activity.endedAt)}`;

	return (
		<div
			className="group absolute"
			style={{
				left: `${segment.leftPercent}%`,
				width: `${segment.widthPercent}%`,
				// 行の上下 4px の余白の内側を段で等分する
				top: `calc(4px + (100% - 8px) * ${lane / laneCount})`,
				height: `calc((100% - 8px) / ${laneCount} - 2px)`,
			}}
		>
			<button
				type="button"
				aria-pressed={isSelected}
				onClick={() => onSelect(session.id)}
				aria-label={`${label}${isActive ? '（進行中）' : ''}`}
				className={cn(
					'block',
					'h-full w-full rounded-sm bg-[var(--session-color)] opacity-85 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring',
					// outline-none の後ろで線の種類を戻さないと、枠線が出ない
					isSelected && 'opacity-100 outline-solid outline-2 outline-offset-1 outline-foreground',
					isActive &&
						'animate-pulse ring-2 ring-foreground/70 ring-offset-1 ring-offset-background',
				)}
				style={{ '--session-color': color } as React.CSSProperties}
			/>
			<div
				role="tooltip"
				className={cn(
					'pointer-events-none absolute z-20',
					tooltipAbove ? 'bottom-full mb-1' : 'top-full mt-1',
					// 右半分のバーはツールチップを右揃えにして、ペインの外にはみ出さないようにする
					segment.leftPercent > 50 ? 'right-0' : 'left-0',
					'hidden w-max max-w-64 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-modal group-focus-within:block group-hover:block',
				)}
			>
				<p className="font-bold">
					{session.project.name}
					{isActive && <span className="ml-2 text-primary">● 進行中</span>}
				</p>
				<p className="mt-1">
					{formatTime(activity.startedAt)}〜{formatTime(activity.endedAt)}
				</p>
				{session.summary && <p className="mt-1 line-clamp-3">{session.summary}</p>}
				{session.tags.length > 0 && (
					<p className="mt-1 text-muted-foreground">
						{session.tags.map((tag) => `#${tag}`).join(' ')}
					</p>
				)}
				<p className="text-muted-foreground">
					{formatTokens(session.totalTokens)} トークン ・ {session.messageCount} メッセージ
				</p>
			</div>
		</div>
	);
}
