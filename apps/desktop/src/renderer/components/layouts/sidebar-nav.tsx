import { cn } from '@/lib/utils/cn';
import type { PageKey } from '@/pages/page-key';
import { CalendarRange, LayoutDashboard, List, type LucideIcon, Settings } from 'lucide-react';

const navItems: { key: PageKey; label: string; icon: LucideIcon }[] = [
	{ key: 'timeline', label: 'タイムライン', icon: CalendarRange },
	{ key: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
	{ key: 'session-list', label: 'セッション一覧', icon: List },
	{ key: 'settings', label: '設定', icon: Settings },
];

type Props = {
	current: PageKey;
	onNavigate: (page: PageKey) => void;
};

export function SidebarNav({ current, onNavigate }: Props) {
	return (
		<aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
			<div className="px-4 py-4">
				<h1 className="text-base font-bold text-sidebar-foreground">CC Work History</h1>
			</div>
			<nav aria-label="メイン" className="flex flex-col gap-1 px-3">
				{navItems.map((item) => {
					const isActive = item.key === current;
					return (
						<button
							key={item.key}
							type="button"
							onClick={() => onNavigate(item.key)}
							aria-current={isActive ? 'page' : undefined}
							className={cn(
								'flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
								isActive
									? 'bg-sidebar-accent text-sidebar-accent-foreground'
									: 'text-sidebar-foreground hover:bg-sidebar-accent/50',
							)}
						>
							<item.icon className="h-4 w-4" aria-hidden />
							{item.label}
						</button>
					);
				})}
			</nav>
		</aside>
	);
}
