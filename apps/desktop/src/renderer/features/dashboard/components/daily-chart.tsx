import { formatDuration } from '@/lib/utils/format';
import type { DashboardDto } from '@shared/ipc-contract';

type Props = {
	daily: DashboardDto['daily'];
};

const dayLabel = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' });
const weekdayLabel = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' });

/** 日別の活動時間（1 系列の棒グラフ）。値は各棒のツールチップと表でも確認できる */
export function DailyChart({ daily }: Props) {
	const max = Math.max(...daily.map((d) => d.activeMs), 0);
	// 目盛りは 1 時間単位で切りのよい値にする
	const scaleMax = Math.max(Math.ceil(max / 3_600_000), 1) * 3_600_000;
	const compact = daily.length > 10;

	return (
		<figure className="flex flex-col gap-2">
			<figcaption className="text-sm font-bold text-muted-foreground">日別の活動時間</figcaption>
			<div className="relative flex h-48 items-end gap-0.5 border-b pt-4">
				{/* 目盛り線（控えめに） */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-4 border-t border-dashed"
				/>
				<span aria-hidden className="absolute top-0 right-0 text-xs text-muted-foreground">
					{formatDuration(scaleMax)}
				</span>
				{daily.map((day) => {
					const date = new Date(day.date);
					const label = `${dayLabel.format(date)}(${weekdayLabel.format(date)})`;
					const description = `${label} ${formatDuration(day.activeMs)}・${day.sessionCount} セッション`;
					return (
						<div key={day.date} className="group relative flex h-full flex-1 items-end">
							<div
								role="img"
								aria-label={description}
								className="w-full rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
								style={{ height: `${(day.activeMs / scaleMax) * 100}%` }}
							/>
							<div
								role="tooltip"
								className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-max -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-modal group-hover:block"
							>
								{description}
							</div>
						</div>
					);
				})}
			</div>
			<div aria-hidden className="flex gap-0.5 text-xs text-muted-foreground">
				{daily.map((day, i) => {
					const date = new Date(day.date);
					const show = !compact || i % 5 === 0;
					return (
						<span key={day.date} className="flex-1 text-center">
							{show ? (compact ? dayLabel.format(date) : weekdayLabel.format(date)) : ''}
						</span>
					);
				})}
			</div>
			<details className="text-sm">
				<summary className="cursor-pointer text-muted-foreground">表で見る</summary>
				<table className="mt-2 w-full text-left">
					<thead>
						<tr className="text-muted-foreground">
							<th className="font-normal">日付</th>
							<th className="font-normal">活動時間</th>
							<th className="font-normal">セッション</th>
						</tr>
					</thead>
					<tbody>
						{daily.map((day) => {
							const date = new Date(day.date);
							return (
								<tr key={day.date}>
									<td>
										{dayLabel.format(date)}({weekdayLabel.format(date)})
									</td>
									<td>{formatDuration(day.activeMs)}</td>
									<td>{day.sessionCount}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</details>
		</figure>
	);
}
