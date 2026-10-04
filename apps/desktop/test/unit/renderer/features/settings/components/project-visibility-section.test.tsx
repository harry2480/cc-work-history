// @vitest-environment jsdom
import { ProjectVisibilitySection } from '@/features/settings/components/project-visibility-section';
import { useTimelineStore } from '@/stores/timeline-store';
import type { DesktopApi, ProjectVisibilityDto } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let projects: ProjectVisibilityDto[];
let updateProjectVisibility: ReturnType<typeof vi.fn<DesktopApi['updateProjectVisibility']>>;

beforeEach(() => {
	useTimelineStore.setState({ dataVersion: 0 });
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
