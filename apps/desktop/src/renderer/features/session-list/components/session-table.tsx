import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import {
	formatDuration,
	formatInteger,
	formatShortDateTime,
	formatTokens,
} from '@/lib/utils/format';
import { useFilterStore } from '@/stores/filter-store';
import { useTimelineStore } from '@/stores/timeline-store';
import type { ListSessionsRequest, SessionSortKeyDto } from '@shared/ipc-contract';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSessionList } from '../api/use-session-list';

export const PAGE_SIZE = 50;

type Sort = ListSessionsRequest['sort'];

const COLUMNS: { key: SessionSortKeyDto; label: string; className?: string }[] = [
	{ key: 'startedAt', label: '開始日時' },
	{ key: 'project', label: 'プロジェクト・概要' },
	{ key: 'activeDuration', label: '活動時間', className: 'text-right' },
	{ key: 'totalTokens', label: 'トークン', className: 'text-right' },
];

/** セッション一覧。列の見出しで並び替え、50 件ずつページを送る */
export function SessionTable() {
	const [sort, setSort] = useState<Sort>({ key: 'startedAt', direction: 'desc' });
	const [page, setPage] = useState(1);
	const { data, loading, error } = useSessionList(sort, page, PAGE_SIZE);
	const selectedSessionId = useTimelineStore((s) => s.selectedSessionId);
	const selectSession = useTimelineStore((s) => s.selectSession);
	const projectIds = useFilterStore((s) => s.projectIds);
	const tags = useFilterStore((s) => s.tags);
	const query = useFilterStore((s) => s.query);

	// 絞り込み・並び替えが変わったら 1 ページ目に戻る
	// biome-ignore lint/correctness/useExhaustiveDependencies: 条件が変わったときだけ戻す
	useEffect(() => {
		setPage(1);
	}, [sort, projectIds, tags, query]);

	const toggleSort = (key: SessionSortKeyDto) =>
		setSort((current) =>
			current.key === key
				? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
				: { key, direction: key === 'project' ? 'asc' : 'desc' },
		);

	const total = data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
	const last = Math.min(page * PAGE_SIZE, total);

	return (
		<div className="flex flex-col gap-3">
			{error && (
				<p role="alert" className="text-sm text-destructive">
					一覧を読み込めませんでした: {error}
				</p>
			)}
			<Table>
				<TableHeader>
					<TableRow>
						{COLUMNS.map((column) => (
							<TableHead
								key={column.key}
								className={column.className}
								aria-sort={
									sort.key === column.key
										? sort.direction === 'asc'
											? 'ascending'
											: 'descending'
										: 'none'
								}
							>
								<button
									type="button"
									onClick={() => toggleSort(column.key)}
									className="inline-flex items-center gap-1 hover:text-foreground"
								>
									{column.label}
									{sort.key === column.key &&
										(sort.direction === 'asc' ? (
											<ArrowUp className="size-3" aria-hidden />
										) : (
											<ArrowDown className="size-3" aria-hidden />
										))}
								</button>
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{data?.items.map((item) => (
						<TableRow
							key={item.id}
							aria-selected={item.id === selectedSessionId}
							onClick={() => selectSession(item.id)}
							className={cn('cursor-pointer', item.id === selectedSessionId && 'bg-accent')}
						>
							<TableCell className="whitespace-nowrap">
								<button
									type="button"
									className="text-left hover:underline"
									onClick={(e) => {
										e.stopPropagation();
										selectSession(item.id);
									}}
								>
									{formatShortDateTime(new Date(item.startedAt))}
								</button>
								{item.status === 'active' && (
									<span className="block text-xs text-primary">● 進行中</span>
								)}
							</TableCell>
							<TableCell className="max-w-56 min-w-0">
								<p title={item.project.path} className="truncate font-medium">
									{item.project.name}
								</p>
								{item.summary && (
									<p className="truncate text-xs text-muted-foreground">{item.summary}</p>
								)}
								{item.tags.length > 0 && (
									<div className="mt-1 flex flex-wrap gap-1">
										{item.tags.map((tag) => (
											<Badge key={tag} variant="secondary">
												#{tag}
											</Badge>
										))}
									</div>
								)}
							</TableCell>
							<TableCell className="text-right whitespace-nowrap">
								{formatDuration(item.activeDurationMs)}
							</TableCell>
							<TableCell className="text-right">{formatTokens(item.totalTokens)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{data && data.items.length === 0 && !loading && (
				<p className="text-sm text-muted-foreground">該当するセッションはありません。</p>
			)}
			<nav aria-label="ページ" className="flex items-center justify-end gap-2 text-sm">
				<span className="text-muted-foreground">
					{formatInteger(first)}〜{formatInteger(last)} / {formatInteger(total)} 件
				</span>
				<Button
					variant="outline"
					size="icon"
					aria-label="前のページ"
					disabled={page <= 1}
					onClick={() => setPage((p) => p - 1)}
				>
					<ChevronLeft />
				</Button>
				<span>
					{page} / {pageCount}
				</span>
				<Button
					variant="outline"
					size="icon"
					aria-label="次のページ"
					disabled={page >= pageCount}
					onClick={() => setPage((p) => p + 1)}
				>
					<ChevronRight />
				</Button>
			</nav>
		</div>
	);
}
