// @vitest-environment jsdom
import { SessionResultSection } from '@/features/session-detail/components/session-result-section';
import type { DesktopApi, SessionsChangedPayload } from '@shared/ipc-contract';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let getSessionResult: ReturnType<typeof vi.fn<DesktopApi['getSessionResult']>>;
let notifyChange: (payload: SessionsChangedPayload) => void;

beforeEach(() => {
	getSessionResult = vi.fn<DesktopApi['getSessionResult']>(async () => ({
		status: 'commits',
		commitCount: 1234,
		changedFileCount: 5,
		computedAt: new Date().toISOString(),
	}));
	notifyChange = () => {};
	window.api = {
		getSessionResult,
		onSessionsChanged: (listener: (payload: SessionsChangedPayload) => void) => {
			notifyChange = listener;
			return () => {};
		},
	} as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
});

describe('SessionResultSection', () => {
	it('コミット数と変更したファイルの数を表示する', async () => {
		render(<SessionResultSection sessionId="s1" />);

		expect(await screen.findByText('1,234')).toBeTruthy();
		expect(screen.getByText('5')).toBeTruthy();
		expect(getSessionResult).toHaveBeenCalledWith({ id: 's1' });
	});

	it('git リポジトリでなければ「なし」と表示する', async () => {
		getSessionResult.mockResolvedValue({ status: 'no_repository' });
		render(<SessionResultSection sessionId="s1" />);

		expect(await screen.findByText(/なし（git リポジトリではありません）/)).toBeTruthy();
	});

	it('集計できなかった理由を表示する', async () => {
		getSessionResult.mockResolvedValue({ status: 'unavailable', reason: 'git が見つかりません' });
		render(<SessionResultSection sessionId="s1" />);

		expect(await screen.findByText(/git が見つかりません/)).toBeTruthy();
	});

	it('このセッションの更新通知が届いたら取り直す', async () => {
		render(<SessionResultSection sessionId="s1" />);
		await screen.findByText('1,234');

		act(() => notifyChange({ sessionIds: ['other'], from: '', to: '' }));
		expect(getSessionResult).toHaveBeenCalledTimes(1);

		getSessionResult.mockResolvedValue({
			status: 'commits',
			commitCount: 7,
			changedFileCount: 8,
			computedAt: new Date().toISOString(),
		});
		act(() => notifyChange({ sessionIds: ['s1'], from: '', to: '' }));
		expect(await screen.findByText('7')).toBeTruthy();
	});

	it('先に頼んだ集計の応答が後から届いても、新しい表示を上書きしない', async () => {
		let resolveFirst: (value: Awaited<ReturnType<DesktopApi['getSessionResult']>>) => void =
			() => {};
		getSessionResult.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveFirst = resolve;
				}),
		);
		getSessionResult.mockResolvedValueOnce({
			status: 'commits',
			commitCount: 2,
			changedFileCount: 9,
			computedAt: new Date().toISOString(),
		});
		render(<SessionResultSection sessionId="s1" />);

		act(() => notifyChange({ sessionIds: ['s1'], from: '', to: '' }));
		expect(await screen.findByText('9')).toBeTruthy();

		await act(async () => {
			resolveFirst({
				status: 'commits',
				commitCount: 100,
				changedFileCount: 100,
				computedAt: new Date().toISOString(),
			});
		});
		expect(screen.queryByText('100')).toBeNull();
		expect(screen.getByText('9')).toBeTruthy();
	});
});
