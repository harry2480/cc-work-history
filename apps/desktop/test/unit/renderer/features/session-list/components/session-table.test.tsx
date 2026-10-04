// @vitest-environment jsdom
import { PAGE_SIZE, SessionTable } from '@/features/session-list/components/session-table';
import { useFilterStore } from '@/stores/filter-store';
import { useTimelineStore } from '@/stores/timeline-store';
import type { DesktopApi, ListSessionsRequest, SessionListItemDto } from '@shared/ipc-contract';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function item(id: string, overrides: Partial<SessionListItemDto> = {}): SessionListItemDto {
	return {
		id,
		project: { id: 'p1', name: 'app', path: '/repo/app' },
		startedAt: new Date(2026, 9, 1, 9, 0).toISOString(),
		endedAt: new Date(2026, 9, 1, 10, 0).toISOString(),
		activeDurationMs: 45 * 60_000,
		status: 'completed',
		totalTokens: 12_000,
		messageCount: 8,
		summary: null,
		tags: [],
		...overrides,
	};
}

let listSessions: ReturnType<typeof vi.fn<DesktopApi['listSessions']>>;
const lastRequest = () => listSessions.mock.calls.at(-1)?.[0] as ListSessionsRequest;

beforeEach(() => {
	useFilterStore.getState().clear();
	useTimelineStore.setState({ selectedSessionId: null });
	listSessions = vi.fn<DesktopApi['listSessions']>(async (request) => ({
		items: [item('s1', { summary: '誤字を直した', tags: ['docs'], status: 'active' }), item('s2')],
		total: 120,
		page: request.page,
		pageSize: request.pageSize,
	}));
	window.api = { listSessions, onSessionsChanged: () => () => {} } as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
});

describe('SessionTable', () => {
	it('開始日時の新しい順で 1 ページ目を取得し、各列を表示する', async () => {
		render(<SessionTable />);

		expect(await screen.findByText('誤字を直した')).toBeTruthy();
		expect(lastRequest()).toEqual({
			filter: {},
			sort: { key: 'startedAt', direction: 'desc' },
			page: 1,
			pageSize: PAGE_SIZE,
		});
		expect(screen.getAllByText('app')).toHaveLength(2);
		expect(screen.getAllByText('45分')).toHaveLength(2);
		expect(screen.getByText('#docs')).toBeTruthy();
		expect(screen.getByText('● 進行中')).toBeTruthy();
		expect(screen.getByText('1〜50 / 120 件')).toBeTruthy();
	});

	it('見出しで並び替え、同じ見出しをもう一度押すと向きが変わる', async () => {
		render(<SessionTable />);
		await screen.findByText('誤字を直した');

		fireEvent.click(screen.getByRole('button', { name: 'トークン' }));
		await waitFor(() =>
			expect(lastRequest().sort).toEqual({ key: 'totalTokens', direction: 'desc' }),
		);
		expect(screen.getByRole('columnheader', { name: /トークン/ }).getAttribute('aria-sort')).toBe(
			'descending',
		);

		fireEvent.click(screen.getByRole('button', { name: /トークン/ }));
		await waitFor(() =>
			expect(lastRequest().sort).toEqual({ key: 'totalTokens', direction: 'asc' }),
		);

		fireEvent.click(screen.getByRole('button', { name: 'プロジェクト・概要' }));
		await waitFor(() => expect(lastRequest().sort).toEqual({ key: 'project', direction: 'asc' }));
	});

	it('ページを送り、並び替えや絞り込みを変えると 1 ページ目に戻る', async () => {
		render(<SessionTable />);
		await screen.findByText('誤字を直した');
		expect(screen.getByRole('button', { name: '前のページ' })).toHaveProperty('disabled', true);

		fireEvent.click(screen.getByRole('button', { name: '次のページ' }));
		await waitFor(() => expect(lastRequest().page).toBe(2));
		expect(await screen.findByText('51〜100 / 120 件')).toBeTruthy();

		act(() => useFilterStore.setState({ tags: ['docs'] }));
		await waitFor(() =>
			expect(lastRequest()).toMatchObject({ page: 1, filter: { tags: ['docs'] } }),
		);
	});

	it('行を選ぶと詳細パネル用にセッションを選択する', async () => {
		render(<SessionTable />);
		await screen.findByText('誤字を直した');

		fireEvent.click(screen.getByText('誤字を直した'));
		expect(useTimelineStore.getState().selectedSessionId).toBe('s1');
		expect(screen.getAllByRole('row')[1]?.getAttribute('aria-selected')).toBe('true');
	});

	it('該当がない・取得に失敗した場合はその旨を表示する', async () => {
		listSessions.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE });
		const { unmount } = render(<SessionTable />);
		expect(await screen.findByText('該当するセッションはありません。')).toBeTruthy();
		unmount();

		listSessions.mockRejectedValue(new Error('boom'));
		render(<SessionTable />);
		expect((await screen.findByRole('alert')).textContent).toContain('boom');
	});
});
