// @vitest-environment jsdom
import { ResumeSessionButton } from '@/features/session-detail/components/resume-session-button';
import type { DesktopApi } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let resumeSession: ReturnType<typeof vi.fn<DesktopApi['resumeSession']>>;

beforeEach(() => {
	resumeSession = vi.fn<DesktopApi['resumeSession']>(async () => ({ status: 'ok' }));
	window.api = { resumeSession } as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
});

describe('ResumeSessionButton', () => {
	it('押すとセッションの再開を頼み、ターミナルを開いたことを知らせる', async () => {
		render(<ResumeSessionButton sessionId="s1" />);

		fireEvent.click(screen.getByRole('button', { name: 'ターミナルで再開' }));

		expect(await screen.findByText('ターミナルを開きました。')).toBeTruthy();
		expect(resumeSession).toHaveBeenCalledWith({ id: 's1' });
	});

	it('未対応の OS や開けなかった理由を表示する', async () => {
		resumeSession.mockResolvedValue({
			status: 'unsupported',
			reason: 'セッションの再開は今のところ macOS だけに対応しています',
		});
		render(<ResumeSessionButton sessionId="s1" />);

		fireEvent.click(screen.getByRole('button', { name: 'ターミナルで再開' }));

		expect(await screen.findByText(/macOS だけに対応/)).toBeTruthy();
	});

	it('main でエラーになったら、Electron の前置きを除いて表示する', async () => {
		resumeSession.mockRejectedValue(
			new Error(
				"Error invoking remote method 'sessions:resume': SessionNotFoundError: セッションが見つかりません: s1",
			),
		);
		render(<ResumeSessionButton sessionId="s1" />);

		fireEvent.click(screen.getByRole('button', { name: 'ターミナルで再開' }));

		expect((await screen.findByText(/セッションが見つかりません/)).textContent).toBe(
			'セッションが見つかりません: s1',
		);
	});
});
