import type { PageKey } from '@/pages/page-key';
import type { ReactNode } from 'react';
import { SidebarNav } from './sidebar-nav';

type Props = {
	current: PageKey;
	onNavigate: (page: PageKey) => void;
	children: ReactNode;
};

/** ウィンドウ高さに固定し、ページ全体はスクロールさせない（docs/スタイルガイド.md） */
export function AppShell({ current, onNavigate, children }: Props) {
	return (
		<div className="flex h-dvh overflow-hidden">
			<SidebarNav current={current} onNavigate={onNavigate} />
			<main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
		</div>
	);
}
