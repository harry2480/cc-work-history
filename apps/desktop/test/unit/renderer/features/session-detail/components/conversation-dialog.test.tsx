// @vitest-environment jsdom
import { ConversationDialog } from '@/features/session-detail/components/conversation-dialog';
import type { DesktopApi, SessionConversationDto } from '@shared/ipc-contract';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let getSessionConversation: ReturnType<typeof vi.fn<DesktopApi['getSessionConversation']>>;

beforeEach(() => {
	getSessionConversation = vi.fn<DesktopApi['getSessionConversation']>(async () => ({
		status: 'ok',
		messages: [
			{ role: 'user', text: 'README の誤字を直して' },
			{ role: 'assistant', text: '直しました' },
		],
		truncated: false,
	}));
	window.api = { getSessionConversation } as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
});

function openDialog(sessionId = 's1') {
	const view = render(<ConversationDialog sessionId={sessionId} projectName="app" />);
	fireEvent.click(screen.getByRole('button', { name: '会話を表示' }));
	return view;
}

describe('ConversationDialog', () => {
	it('開くまではログを読まず、開くと会話を表示する', async () => {
		render(<ConversationDialog sessionId="s1" projectName="app" />);
		expect(getSessionConversation).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole('button', { name: '会話を表示' }));

		expect(await screen.findByText('README の誤字を直して')).toBeTruthy();
		expect(screen.getByText('直しました')).toBeTruthy();
		expect(screen.getByText('2 件')).toBeTruthy();
		expect(getSessionConversation).toHaveBeenCalledWith({ id: 's1' });
	});

	it('一部を省いたときはその旨を表示する', async () => {
		getSessionConversation.mockResolvedValueOnce({
			status: 'ok',
			messages: [{ role: 'user', text: 'こんにちは' }],
			truncated: true,
		});
		openDialog();
		expect(await screen.findByText(/一部を省いています/)).toBeTruthy();
	});

	it.each<[string, SessionConversationDto | null, string]>([
		['ログファイルがない', { status: 'missing' }, 'ログファイルが見つかりませんでした。'],
		['会話がない', { status: 'ok', messages: [], truncated: false }, '会話の記録がありません。'],
		['セッションがない', null, 'セッションが見つかりませんでした。'],
	])('%sときはその旨を表示する', async (_case, response, message) => {
		getSessionConversation.mockResolvedValueOnce(response);
		openDialog();
		expect((await screen.findByRole('status')).textContent).toBe(message);
	});

	it('読み込めなかったらエラーを表示する', async () => {
		getSessionConversation.mockRejectedValueOnce(new Error('読めません'));
		openDialog();
		expect((await screen.findByRole('alert')).textContent).toContain('読めません');
	});

	it('セッションを切り替えたあとに届いた古い応答は表示しない', async () => {
		let resolveOld: (value: SessionConversationDto) => void = () => {};
		getSessionConversation.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveOld = resolve;
				}),
		);
		const { rerender } = openDialog('s1');
		rerender(<ConversationDialog sessionId="s2" projectName="app" />);
		expect(await screen.findByText('README の誤字を直して')).toBeTruthy();

		await act(async () => {
			resolveOld({
				status: 'ok',
				messages: [{ role: 'user', text: '古いセッションの発言' }],
				truncated: false,
			});
		});

		expect(screen.queryByText('古いセッションの発言')).toBeNull();
		expect(screen.getByText('README の誤字を直して')).toBeTruthy();
	});
});
