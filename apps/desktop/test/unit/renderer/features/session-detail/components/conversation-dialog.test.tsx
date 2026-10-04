// @vitest-environment jsdom
import { ConversationDialog } from '@/features/session-detail/components/conversation-dialog';
import type { DesktopApi } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let getSessionConversation: ReturnType<typeof vi.fn<DesktopApi['getSessionConversation']>>;

beforeEach(() => {
	getSessionConversation = vi.fn<DesktopApi['getSessionConversation']>(async () => ({
		status: 'ok',
		messages: [
			{ role: 'user', text: 'README の誤字を直して' },
			{ role: 'assistant', text: '直しました' },
		],
	}));
	window.api = { getSessionConversation } as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
});

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

	it('ログファイルがないとき・会話がないときはその旨を表示する', async () => {
		getSessionConversation.mockResolvedValueOnce({ status: 'missing' });
		render(<ConversationDialog sessionId="s1" projectName="app" />);
		fireEvent.click(screen.getByRole('button', { name: '会話を表示' }));
		expect(await screen.findByText('ログファイルが見つかりませんでした。')).toBeTruthy();
	});

	it('読み込めなかったらエラーを表示する', async () => {
		getSessionConversation.mockRejectedValueOnce(new Error('読めません'));
		render(<ConversationDialog sessionId="s1" projectName="app" />);
		fireEvent.click(screen.getByRole('button', { name: '会話を表示' }));
		expect((await screen.findByRole('alert')).textContent).toContain('読めません');
	});
});
