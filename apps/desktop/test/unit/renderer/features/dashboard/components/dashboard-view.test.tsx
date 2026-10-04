// @vitest-environment jsdom
import { DashboardView } from '@/features/dashboard/components/dashboard-view';
import type { DashboardDto, DesktopApi } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HOUR = 3_600_000;

function dashboard(days: number): DashboardDto {
	return {
		summary: {
			activeMs: 5 * HOUR + 30 * 60_000,
			sessionCount: 12,
			totalTokens: 1_250_000,
			messageCount: 345,
		},
		daily: Array.from({ length: days }, (_, i) => ({
			date: new Date(2026, 8, 28 + i).toISOString(),
			activeMs: i === 1 ? 2 * HOUR : 0,
			sessionCount: i === 1 ? 3 : 0,
		})),
		projects: [
			{
				project: { id: 'p1', name: 'app', path: '/repo/app' },
				activeMs: 4 * HOUR,
				sessionCount: 9,
				totalTokens: 1_000_000,
			},
		],
	};
}

let getDashboard: ReturnType<typeof vi.fn<DesktopApi['getDashboard']>>;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date(2026, 9, 1, 12));
	getDashboard = vi.fn<DesktopApi['getDashboard']>(async (request) =>
		dashboard(
			new Date(request.to).getMonth() !== new Date(request.from).getMonth() &&
				new Date(request.from).getDate() === 1
				? 31
				: 7,
		),
	);
	window.api = { getDashboard, onSessionsChanged: () => () => {} } as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('DashboardView', () => {
	it('今週の統計を取得し、合計・日別・プロジェクト別を表示する', async () => {
		render(<DashboardView />);

		expect(await screen.findByText('5時間 30分')).toBeTruthy();
		expect(getDashboard).toHaveBeenCalledWith({
			from: new Date(2026, 8, 28).toISOString(),
			to: new Date(2026, 9, 5).toISOString(),
		});
		expect(screen.getByText('2026/9/28 〜 10/4')).toBeTruthy();
		expect(screen.getByText('12')).toBeTruthy();
		expect(screen.getByText('125万')).toBeTruthy();
		expect(screen.getByText('345')).toBeTruthy();
		// 日別の棒（読み上げ用のラベルに値を含める）
		expect(screen.getAllByRole('img')).toHaveLength(7);
		expect(screen.getByRole('img', { name: '9/29(火) 2時間・3 セッション' })).toBeTruthy();
		// プロジェクト別
		const row = screen.getByRole('row', { name: /app/ });
		expect(row.textContent).toContain('4時間');
		expect(row.textContent).toContain('9');
	});

	it('月に切り替えるとその月の期間で取得し、前後の期間に移動できる', async () => {
		render(<DashboardView />);
		await screen.findByText('5時間 30分');

		fireEvent.click(screen.getByRole('button', { name: '月' }));
		await waitFor(() =>
			expect(getDashboard).toHaveBeenLastCalledWith({
				from: new Date(2026, 8, 1).toISOString(),
				to: new Date(2026, 9, 1).toISOString(),
			}),
		);
		expect(screen.getByText('2026年9月')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: '次の期間' }));
		await waitFor(() => expect(screen.getByText('2026年10月')).toBeTruthy());
	});

	it('取得に失敗したらエラーを表示する', async () => {
		getDashboard.mockRejectedValue(new Error('boom'));
		render(<DashboardView />);

		expect((await screen.findByRole('alert')).textContent).toContain('boom');
	});
});
