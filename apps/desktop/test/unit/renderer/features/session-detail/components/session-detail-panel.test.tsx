// @vitest-environment jsdom
import { SessionDetailPanel } from '@/features/session-detail/components/session-detail-panel';
import { useTimelineStore } from '@/stores/timeline-store';
import type { DesktopApi, SessionDetailDto, SessionsChangedPayload } from '@shared/ipc-contract';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const at = (hour: number, min = 0) => new Date(2026, 9, 1, hour, min).toISOString();

function detail(overrides: Partial<SessionDetailDto> = {}): SessionDetailDto {
	return {
		id: 's1',
		project: { id: 'p1', name: 'app', path: '/Users/me/repo/app' },
		cwd: '/Users/me/repo/app/packages/web',
		startedAt: at(9),
		endedAt: at(11, 30),
		activeDurationMs: 95 * 60_000,
		status: 'completed',
		inputTokens: 123_456,
		outputTokens: 7_890,
		totalTokens: 131_346,
		messageCount: 42,
		models: ['claude-opus-5-5', 'claude-sonnet-5-5'],
		summary: null,
		summaryEditedManually: false,
		tags: [],
		activities: [
			{ startedAt: at(9), endedAt: at(10), messageCount: 30 },
			{ startedAt: at(10, 55), endedAt: at(11, 30), messageCount: 12 },
		],
		...overrides,
	};
}

let getSessionDetail: ReturnType<typeof vi.fn<DesktopApi['getSessionDetail']>>;
let notifyChange: (payload: SessionsChangedPayload) => void;

beforeEach(() => {
	useTimelineStore.setState({ selectedSessionId: null });
	getSessionDetail = vi.fn<DesktopApi['getSessionDetail']>(async () => detail());
	notifyChange = () => {};
	window.api = {
		ping: vi.fn(),
		getTimeline: vi.fn(),
		updateSessionAnnotation: vi.fn(async () => {}),
		getSessionDetail,
		onSessionsChanged: (listener) => {
			notifyChange = listener;
			return () => {};
		},
	};
});

afterEach(() => {
	cleanup();
});

describe('SessionDetailPanel', () => {
	it('未選択のときは案内を表示し、取得しない', () => {
		render(<SessionDetailPanel />);

		expect(screen.getByText(/タイムラインでセッションを選ぶと/)).toBeTruthy();
		expect(getSessionDetail).not.toHaveBeenCalled();
	});

	it('選択したセッションの基本情報・状態・使用量・活動区間を表示する', async () => {
		useTimelineStore.setState({ selectedSessionId: 's1' });
		render(<SessionDetailPanel />);

		expect(await screen.findByRole('heading', { name: 'app' })).toBeTruthy();
		expect(getSessionDetail).toHaveBeenCalledWith({ id: 's1' });
		const text = document.body.textContent ?? '';
		expect(text).toContain('/Users/me/repo/app');
		expect(text).toContain('完了');
		expect(text).toContain('1時間 35分');
		expect(text).toContain('/Users/me/repo/app/packages/web');
		expect(text).toContain('claude-opus-5-5, claude-sonnet-5-5');
		expect(text).toContain('123,456');
		expect(text).toContain('7,890');
		expect(text).toContain('131,346');
		expect(text).toContain('42');
		expect(text).toContain('活動区間（2）');
	});

	it('進行中のセッションはバッジで示す', async () => {
		getSessionDetail.mockResolvedValue(detail({ status: 'active' }));
		useTimelineStore.setState({ selectedSessionId: 's1' });
		render(<SessionDetailPanel />);

		expect(await screen.findByText('● 進行中')).toBeTruthy();
	});

	it('選択中のセッションの更新通知が届いたら取り直す。他のセッションの通知では取り直さない', async () => {
		useTimelineStore.setState({ selectedSessionId: 's1' });
		render(<SessionDetailPanel />);
		await screen.findByRole('heading', { name: 'app' });

		act(() => notifyChange({ sessionIds: ['other'], from: at(9), to: at(10) }));
		expect(getSessionDetail).toHaveBeenCalledTimes(1);

		getSessionDetail.mockResolvedValue(detail({ messageCount: 99 }));
		act(() => notifyChange({ sessionIds: ['s1'], from: at(9), to: at(12) }));
		expect(await screen.findByText('99')).toBeTruthy();
		expect(getSessionDetail).toHaveBeenCalledTimes(2);
	});

	it('見つからなければその旨を表示する', async () => {
		getSessionDetail.mockResolvedValue(null);
		useTimelineStore.setState({ selectedSessionId: 'missing' });
		render(<SessionDetailPanel />);

		expect(await screen.findByText('セッションが見つかりませんでした。')).toBeTruthy();
	});

	it('取得に失敗したらエラーを表示する', async () => {
		getSessionDetail.mockRejectedValue(new Error('boom'));
		useTimelineStore.setState({ selectedSessionId: 's1' });
		render(<SessionDetailPanel />);

		expect((await screen.findByRole('alert')).textContent).toContain('boom');
	});
});
