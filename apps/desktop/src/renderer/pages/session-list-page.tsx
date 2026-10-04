import { FilterBar } from '@/features/filters/components/filter-bar';
import { SessionDetailPanel } from '@/features/session-detail/components/session-detail-panel';
import { SessionTable } from '@/features/session-list/components/session-table';

/** セッション一覧。左: 絞り込みと表、右: 選択したセッションの詳細 */
export function SessionListPage() {
	return (
		<div className="flex min-h-0 flex-1">
			<section aria-label="セッション一覧" className="min-w-0 flex-1 overflow-auto p-6">
				<div className="flex flex-col gap-4">
					<FilterBar />
					<SessionTable />
				</div>
			</section>
			<aside
				aria-label="セッション詳細"
				className="w-96 shrink-0 overflow-auto border-l bg-card p-6"
			>
				<SessionDetailPanel />
			</aside>
		</div>
	);
}
