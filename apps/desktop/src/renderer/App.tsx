import { AppShell } from '@/components/layouts/app-shell';
import { DashboardPage } from '@/pages/dashboard-page';
import type { PageKey } from '@/pages/page-key';
import { SessionListPage } from '@/pages/session-list-page';
import { SettingsPage } from '@/pages/settings-page';
import { TimelinePage } from '@/pages/timeline-page';
import { useState } from 'react';

const pages: Record<PageKey, () => JSX.Element> = {
	timeline: TimelinePage,
	dashboard: DashboardPage,
	'session-list': SessionListPage,
	settings: SettingsPage,
};

export function App() {
	const [current, setCurrent] = useState<PageKey>('timeline');
	const Page = pages[current];

	return (
		<AppShell current={current} onNavigate={setCurrent}>
			<Page />
		</AppShell>
	);
}
