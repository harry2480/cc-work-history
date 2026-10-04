// @vitest-environment jsdom
import { TimelineView } from '@/features/timeline/components/timeline-view';
import { useDisplaySettingsStore } from '@/stores/display-settings-store';
import { useFilterStore } from '@/stores/filter-store';
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
		summary: null,
		tags: [],
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
	useTimelineStore.setState({ weekStart, zoom: 1 });
	useDisplaySettingsStore.setState({ colorBy: 'project' });
	getTimeline = vi.fn<DesktopApi['getTimeline']>(async () => timeline([session()]));
	notifyChange = () => {};
	window.api = {
		ping: vi.fn(),
		getTimeline,
		getSessionDetail: vi.fn(),
		updateSessionAnnotation: vi.fn(),
		getFilterOptions: vi.fn(async () => ({ projects: [], tags: [] })),
		getDashboard: vi.fn(),
		listSessions: vi.fn(),
		getSettings: vi.fn(),
		updateIdleThreshold: vi.fn(),
		resumeSession: vi.fn(),
		getSessionResult: vi.fn(async () => null),
		generateSessionSummary: vi.fn(),
		getSessionConversation: vi.fn(),
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
			filter: {},
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

	it('色分けの基準を切り替えると凡例が変わり、選択を保存する', async () => {
		getTimeline.mockResolvedValue(
			timeline([session({ tags: ['docs'] }), session({ id: 's2', status: 'active', tags: [] })]),
		);
		render(<TimelineView />);
		await screen.findAllByRole('button', { name: /^app/ });
		const legend = () => screen.getByRole('list', { name: '凡例' }).textContent;
		expect(legend()).toBe('app');

		fireEvent.click(screen.getByRole('button', { name: 'タグ' }));
		expect(legend()).toBe('#docsタグなし');
		expect(screen.getByText(/最初のタグの色/)).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'ステータス' }));
		expect(legend()).toBe('完了進行中');
		expect(screen.getByRole('button', { name: 'ステータス' }).getAttribute('aria-pressed')).toBe(
			'true',
		);
		expect(localStorage.getItem('cc-work-history:display-settings')).toContain(
			'"colorBy":"status"',
		);
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
				filter: {},
			}),
		);

		fireEvent.click(screen.getByRole('button', { name: '次の週' }));
		fireEvent.click(screen.getByRole('button', { name: '次の週' }));
		await waitFor(() => expect(screen.getByText('2026/10/5 〜 10/11')).toBeTruthy());

		fireEvent.click(screen.getByRole('button', { name: '今週' }));
		expect(useTimelineStore.getState().weekStart.getDay()).toBe(1);
	});

	it('日付を指定するとその日を含む週に移動する', async () => {
		render(<TimelineView />);
		await screen.findByRole('button', { name: /^app/ });

		fireEvent.change(screen.getByLabelText('日付を指定して移動'), {
			target: { value: '2026-11-04' },
		});

		expect(useTimelineStore.getState().weekStart).toEqual(new Date(2026, 10, 2));
	});

	it('絞り込み条件をリクエストに含める', async () => {
		useFilterStore.setState({ projectIds: ['p1'], tags: [], query: ' 誤字 ' });
		render(<TimelineView />);

		await waitFor(() =>
			expect(getTimeline).toHaveBeenLastCalledWith(
				expect.objectContaining({ filter: { projectIds: ['p1'], query: '誤字' } }),
			),
		);
		useFilterStore.getState().clear();
	});

	it('ボタンで拡大・縮小し、下限・上限ではボタンを押せない', async () => {
		render(<TimelineView />);
		await screen.findByRole('button', { name: /^app/ });
		expect(screen.getByRole('button', { name: '縮小' })).toHaveProperty('disabled', true);

		fireEvent.click(screen.getByRole('button', { name: '拡大' }));
		expect(useTimelineStore.getState().zoom).toBe(1.5);
		expect(screen.getByRole('button', { name: 'ズームを元に戻す' }).textContent).toBe('150%');
		// 時間軸の幅が倍率に応じて広がる
		const content = screen.getByTestId('timeline-scroll').firstElementChild as HTMLElement;
		expect(content.style.width).toContain('1.5');

		for (let i = 0; i < 10; i++) fireEvent.click(screen.getByRole('button', { name: '拡大' }));
		expect(useTimelineStore.getState().zoom).toBe(12);
		expect(screen.getByRole('button', { name: '拡大' })).toHaveProperty('disabled', true);

		fireEvent.click(screen.getByRole('button', { name: 'ズームを元に戻す' }));
		expect(useTimelineStore.getState().zoom).toBe(1);
	});

	it('キーボードの + / - / 0 で拡大・縮小・元に戻す。入力欄では反応しない', async () => {
		render(<TimelineView />);
		await screen.findByRole('button', { name: /^app/ });

		fireEvent.keyDown(window, { key: '+' });
		fireEvent.keyDown(window, { key: '+' });
		expect(useTimelineStore.getState().zoom).toBe(2);
		fireEvent.keyDown(window, { key: '-' });
		expect(useTimelineStore.getState().zoom).toBe(1.5);
		fireEvent.keyDown(screen.getByLabelText('日付を指定して移動'), { key: '0' });
		expect(useTimelineStore.getState().zoom).toBe(1.5);
		fireEvent.keyDown(window, { key: '0' });
		expect(useTimelineStore.getState().zoom).toBe(1);
	});

	it('Ctrl/⌘ + ホイールで拡大・縮小し、ただのホイールでは変わらない', async () => {
		render(<TimelineView />);
		await screen.findByRole('button', { name: /^app/ });
		const scroll = screen.getByTestId('timeline-scroll');

		scroll.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, bubbles: true, cancelable: true }));
		expect(useTimelineStore.getState().zoom).toBe(1);

		const pinch = new WheelEvent('wheel', {
			deltaY: -100,
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		});
		act(() => {
			scroll.dispatchEvent(pinch);
		});
		expect(useTimelineStore.getState().zoom).toBe(1.5);
		expect(pinch.defaultPrevented).toBe(true);

		act(() => {
			scroll.dispatchEvent(
				new WheelEvent('wheel', { deltaY: 100, metaKey: true, bubbles: true, cancelable: true }),
			);
		});
		expect(useTimelineStore.getState().zoom).toBe(1);
	});

	it('トラックパッドのピンチ（小さな deltaY の連続）は、たまった量に応じて 1 段階ずつ動かす', async () => {
		render(<TimelineView />);
		await screen.findByRole('button', { name: /^app/ });
		const scroll = screen.getByTestId('timeline-scroll');
		const pinch = (deltaY: number) =>
			act(() => {
				scroll.dispatchEvent(
					new WheelEvent('wheel', { deltaY, ctrlKey: true, bubbles: true, cancelable: true }),
				);
			});

		for (let i = 0; i < 4; i++) pinch(-10);
		expect(useTimelineStore.getState().zoom).toBe(1);
		pinch(-10);
		expect(useTimelineStore.getState().zoom).toBe(1.5);
		// 横方向だけの動き（deltaY 0）では縮小しない
		pinch(0);
		expect(useTimelineStore.getState().zoom).toBe(1.5);
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

		expect(await screen.findByText('この週に該当するセッションはありません。')).toBeTruthy();
	});

	it('取得に失敗したらエラーを表示する', async () => {
		getTimeline.mockRejectedValue(new Error('boom'));
		render(<TimelineView />);

		expect((await screen.findByRole('alert')).textContent).toContain('boom');
	});
});
