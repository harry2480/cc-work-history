import { Button } from '@/components/ui/button';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { formatDuration, formatInteger, formatTokens } from '@/lib/utils/format';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useDashboard } from '../api/use-dashboard';
import {
	type DashboardPeriod,
	type PeriodKind,
	formatPeriod,
	periodContaining,
	shiftPeriod,
} from '../utils/period';
import { DailyChart } from './daily-chart';

export function DashboardView() {
	const [period, setPeriod] = useState<DashboardPeriod>(() => periodContaining('week', new Date()));
	const { data, loading, error } = useDashboard(period);
	const changeKind = (kind: PeriodKind) => setPeriod(periodContaining(kind, period.from));

	return (
		<div className="flex flex-col gap-6">
			<header className="flex flex-wrap items-center gap-2">
				<fieldset className="flex gap-1">
					<legend className="sr-only">期間の単位</legend>
					{(['week', 'month'] as const).map((kind) => (
						<Button
							key={kind}
							size="sm"
							variant={period.kind === kind ? 'default' : 'outline'}
							aria-pressed={period.kind === kind}
							onClick={() => changeKind(kind)}
						>
							{kind === 'week' ? '週' : '月'}
						</Button>
					))}
				</fieldset>
				<Button
					variant="outline"
					size="icon"
					aria-label="前の期間"
					onClick={() => setPeriod(shiftPeriod(period, -1))}
				>
					<ChevronLeft />
				</Button>
				<Button
					variant="outline"
					size="icon"
					aria-label="次の期間"
					onClick={() => setPeriod(shiftPeriod(period, 1))}
				>
					<ChevronRight />
				</Button>
				<h2 className="ml-2 whitespace-nowrap text-lg font-bold">{formatPeriod(period)}</h2>
				{loading && <span className="text-xs text-muted-foreground">読み込み中…</span>}
			</header>

			{error && (
				<p role="alert" className="text-sm text-destructive">
					統計を読み込めませんでした: {error}
				</p>
			)}

			{data && (
				<>
					<section aria-label="合計" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<StatTile label="活動時間">{formatDuration(data.summary.activeMs)}</StatTile>
						<StatTile label="セッション">{formatInteger(data.summary.sessionCount)}</StatTile>
						<StatTile label="トークン">{formatTokens(data.summary.totalTokens)}</StatTile>
						<StatTile label="メッセージ">{formatInteger(data.summary.messageCount)}</StatTile>
					</section>

					<DailyChart daily={data.daily} />

					<section aria-label="プロジェクト別">
						<h3 className="mb-2 text-sm font-bold text-muted-foreground">プロジェクト別</h3>
						{data.projects.length === 0 ? (
							<p className="text-sm text-muted-foreground">この期間のセッションはありません。</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>プロジェクト</TableHead>
										<TableHead className="text-right">活動時間</TableHead>
										<TableHead className="text-right">セッション</TableHead>
										<TableHead className="text-right">トークン</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.projects.map((row) => (
										<TableRow key={row.project.id}>
											<TableCell title={row.project.path}>{row.project.name}</TableCell>
											<TableCell className="text-right">{formatDuration(row.activeMs)}</TableCell>
											<TableCell className="text-right">
												{formatInteger(row.sessionCount)}
											</TableCell>
											<TableCell className="text-right">{formatTokens(row.totalTokens)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</section>
				</>
			)}
		</div>
	);
}

function StatTile({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="rounded-card border bg-card p-4 shadow-card">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 text-2xl font-bold">{children}</p>
		</div>
	);
}
