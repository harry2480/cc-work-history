import { FilterBar } from '@/features/filters/components/filter-bar';
import { SessionDetailPanel } from '@/features/session-detail/components/session-detail-panel';
import { TimelineView } from '@/features/timeline/components/timeline-view';

/** メイン画面。左: タイムライン、右: セッション詳細の 2 ペインで、それぞれ独立してスクロールする */
export function TimelinePage() {
	return (
		<div className="flex min-h-0 flex-1">
			<section aria-label="タイムライン" className="min-w-0 flex-1 overflow-auto p-6">
				<div className="flex flex-col gap-4">
					<FilterBar />
					<TimelineView />
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
