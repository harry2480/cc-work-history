// @vitest-environment jsdom
import { ProjectVisibilitySection } from '@/features/settings/components/project-visibility-section';
import { useFilterStore } from '@/stores/filter-store';
import { useTimelineStore } from '@/stores/timeline-store';
import type { DesktopApi, ProjectVisibilityDto } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let projects: ProjectVisibilityDto[];
let updateProjectVisibility: ReturnType<typeof vi.fn<DesktopApi['updateProjectVisibility']>>;

beforeEach(() => {
	useTimelineStore.setState({ dataVersion: 0, selectedSessionId: 's-mem' });
	useFilterStore.setState({ projectIds: ['p-mem', 'p-app'] });
	projects = [
		{ id: 'p-app', name: 'app', path: '/repo/app', hidden: false },
		{ id: 'p-mem', name: 'claude-mem', path: '/repo/claude-mem', hidden: false },
	];
	updateProjectVisibility = vi.fn<DesktopApi['updateProjectVisibility']>(
		async ({ projectId, hidden }) => {
			projects = projects.map((p) => (p.id === projectId ? { ...p, hidden } : p));
		},
	);
	window.api = {
		getProjectVisibility: vi.fn(async () => projects),
		updateProjectVisibility,
		onSessionsChanged: () => () => {},
	} as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
});

describe('ProjectVisibilitySection', () => {
	it('スイッチをオフにすると非表示にし、画面のデータを取り直す', async () => {
		render(<ProjectVisibilitySection />);
		const toggle = await screen.findByRole('switch', { name: 'claude-mem を表示する' });
		expect(toggle.getAttribute('aria-checked')).toBe('true');

		fireEvent.click(toggle);

		await waitFor(() =>
			expect(
				screen.getByRole('switch', { name: 'claude-mem を表示する' }).getAttribute('aria-checked'),
			).toBe('false'),
		);
		expect(updateProjectVisibility).toHaveBeenCalledWith({ projectId: 'p-mem', hidden: true });
		expect(useTimelineStore.getState().dataVersion).toBe(1);
		// 絞り込みから外し、詳細パネルを閉じる
		expect(useFilterStore.getState().projectIds).toEqual(['p-app']);
		expect(useTimelineStore.getState().selectedSessionId).toBeNull();
	});

	it('変更中は次の操作を受け付けず、スイッチは無効にせずフォーカスを保つ', async () => {
		let finish: () => void = () => {};
		updateProjectVisibility.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		render(<ProjectVisibilitySection />);
		const memo = await screen.findByRole('switch', { name: 'claude-mem を表示する' });

		fireEvent.click(memo);
		fireEvent.click(screen.getByRole('switch', { name: 'app を表示する' }));

		expect(updateProjectVisibility).toHaveBeenCalledTimes(1);
		expect(memo.hasAttribute('disabled')).toBe(false);
		expect(memo.getAttribute('aria-disabled')).toBe('true');
		finish();
		await waitFor(() => expect(memo.getAttribute('aria-disabled')).toBe('false'));
	});

	it('変更に失敗したら理由を表示する', async () => {
		updateProjectVisibility.mockRejectedValueOnce(new Error('プロジェクトが見つかりません'));
		render(<ProjectVisibilitySection />);

		fireEvent.click(await screen.findByRole('switch', { name: 'app を表示する' }));

		expect((await screen.findByRole('alert')).textContent).toContain(
			'プロジェクトが見つかりません',
		);
		expect(useTimelineStore.getState().dataVersion).toBe(0);
	});
});
