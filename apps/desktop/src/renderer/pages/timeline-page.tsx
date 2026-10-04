/** メイン画面。左: タイムライン、右: セッション詳細の 2 ペインで、それぞれ独立してスクロールする */
export function TimelinePage() {
	return (
		<div className="flex min-h-0 flex-1">
			<section aria-label="タイムライン" className="min-w-0 flex-1 overflow-auto p-6">
				<h2 className="text-lg font-bold">タイムライン</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					週単位のタイムラインをここに表示します。
				</p>
			</section>
			<aside
				aria-label="セッション詳細"
				className="w-96 shrink-0 overflow-auto border-l bg-card p-6"
			>
				<h2 className="text-lg font-bold">セッション詳細</h2>
				<p className="mt-2 text-sm text-muted-foreground">
					タイムラインでセッションを選ぶと、ここに詳細を表示します。
				</p>
			</aside>
		</div>
	);
}
