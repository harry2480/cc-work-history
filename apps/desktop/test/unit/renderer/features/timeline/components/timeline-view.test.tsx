// @vitest-environment jsdom
import { TimelineView } from '@/features/timeline/components/timeline-view';
import { useTimelineStore } from '@/stores/timeline-store';
import type {
	DesktopApi,
	SessionsChangedPayload,
	TimelineDto,
	TimelineSessionDto,
} from '@shared/ipc-contract';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 2026-09-28（月）0:00（ローカル時刻）からの週を表示する
const weekStart = new Date(2026, 8, 28);
const at = (day: number, hour: number, min = 0) => new Date(2026, 8, day, hour, min).toISOString();

function session(overrides: Partial<TimelineSessionDto> = {}): TimelineSessionDto {
	return {
		id: 's1',
		project: { id: 'p1', name: 'app', path: '/repo/app' },
		startedAt: at(29, 9),
		endedAt: at(29, 10),
		status: 'completed',
		totalTokens: 12_000,
		messageCount: 8,
		activities: [{ startedAt: at(29, 9), endedAt: at(29, 10), messageCount: 8 }],
		...overrides,
	};
}

function timeline(sessions: TimelineSessionDto[]): TimelineDto {
	return { from: '', to: '', sessions };
}

let getTimeline: ReturnType<typeof vi.fn<DesktopApi['getTimeline']>>;
let notifyChange: (payload: SessionsChangedPayload) => void;

beforeEach(() => {
	useTimelineStore.setState({ weekStart });
	getTimeline = vi.fn<DesktopApi['getTimeline']>(async () => timeline([session()]));
	notifyChange = () => {};
	window.api = {
		ping: vi.fn(),
		getTimeline,
		getSessionDetail: vi.fn(),
		onSessionsChanged: (listener) => {
			notifyChange = listener;
			return () => {};
		},
	};
});

afterEach(() => {
	cleanup();
});

describe('TimelineView', () => {
	it('表示中の週の期間でタイムラインを取得し、活動区間をバーで表示する', async () => {
		render(<TimelineView />);

		expect(await screen.findByRole('button', { name: /^app 09:00〜10:00$/ })).toBeTruthy();
		expect(getTimeline).toHaveBeenCalledWith({
			from: weekStart.toISOString(),
			to: new Date(2026, 9, 5).toISOString(),
		});
		expect(screen.getByText('2026/9/28 〜 10/4')).toBeTruthy();
		// ツールチップにトークン数とメッセージ数を出す
		expect(screen.getByRole('tooltip').textContent).toContain('1.2万 トークン ・ 8 メッセージ');
	});

	it('バーをクリックするとセッションを選択する', async () => {
		useTimelineStore.setState({ selectedSessionId: null });
		render(<TimelineView />);
		const bar = await screen.findByRole('button', { name: /^app 09:00〜10:00$/ });

		fireEvent.click(bar);

		expect(useTimelineStore.getState().selectedSessionId).toBe('s1');
		expect(bar.getAttribute('aria-pressed')).toBe('true');
	});

	it('進行中のセッションは読み上げ用のラベルでも示す', async () => {
		getTimeline.mockResolvedValue(timeline([session({ status: 'active' })]));
		render(<TimelineView />);

		expect(await screen.findByRole('button', { name: /（進行中）$/ })).toBeTruthy();
	});

	it('前週・翌週・今週ボタンで週を移動する', async () => {
		render(<TimelineView />);
		await screen.findByRole('button', { name: /^app/ });

		fireEvent.click(screen.getByRole('button', { name: '前の週' }));
		await waitFor(() =>
			expect(getTimeline).toHaveBeenLastCalledWith({
				from: new Date(2026, 8, 21).toISOString(),
				to: weekStart.toISOString(),
			}),
		);

		fireEvent.click(screen.getByRole('button', { name: '次の週' }));
		fireEvent.click(screen.getByRole('button', { name: '次の週' }));
		await waitFor(() => expect(screen.getByText('2026/10/5 〜 10/11')).toBeTruthy());

		fireEvent.click(screen.getByRole('button', { name: '今週' }));
		expect(useTimelineStore.getState().weekStart.getDay()).toBe(1);
	});

	it('表示中の週に関係する更新通知を受けたら取り直す', async () => {
		render(<TimelineView />);
		await screen.findByRole('button', { name: /^app/ });
		getTimeline.mockResolvedValue(
			timeline([
				session(),
				session({
					id: 's2',
					activities: [{ startedAt: at(30, 14), endedAt: at(30, 15), messageCount: 2 }],
				}),
			]),
		);

		act(() => notifyChange({ sessionIds: ['s2'], from: at(30, 14), to: at(30, 15) }));

		expect(await screen.findByRole('button', { name: /^app 14:00〜15:00$/ })).toBeTruthy();
		expect(getTimeline).toHaveBeenCalledTimes(2);
	});

	it('表示中の週と関係ない更新通知では取り直さない', async () => {
		render(<TimelineView />);
		await screen.findByRole('button', { name: /^app/ });

		act(() =>
			notifyChange({
				sessionIds: ['old'],
				from: new Date(2026, 7, 1).toISOString(),
				to: new Date(2026, 7, 2).toISOString(),
			}),
		);

		expect(getTimeline).toHaveBeenCalledTimes(1);
	});

	it('セッションがない週はその旨を表示する', async () => {
		getTimeline.mockResolvedValue(timeline([]));
		render(<TimelineView />);

		expect(await screen.findByText('この週のセッションはありません。')).toBeTruthy();
	});

	it('取得に失敗したらエラーを表示する', async () => {
		getTimeline.mockRejectedValue(new Error('boom'));
		render(<TimelineView />);

		expect((await screen.findByRole('alert')).textContent).toContain('boom');
	});
});
