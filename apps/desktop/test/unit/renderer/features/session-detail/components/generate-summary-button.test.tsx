// @vitest-environment jsdom
import { GenerateSummaryButton } from '@/features/session-detail/components/generate-summary-button';
import { useTimelineStore } from '@/stores/timeline-store';
import type { DesktopApi } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let generateSessionSummary: ReturnType<typeof vi.fn<DesktopApi['generateSessionSummary']>>;

beforeEach(() => {
	useTimelineStore.setState({ dataVersion: 0 });
	generateSessionSummary = vi.fn<DesktopApi['generateSessionSummary']>(async () => ({
		status: 'ok',
	}));
	window.api = { generateSessionSummary } as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
});

describe('GenerateSummaryButton', () => {
	it('押すと生成を頼み、終わったら画面のデータを取り直す', async () => {
		render(<GenerateSummaryButton sessionId="s1" />);

		fireEvent.click(screen.getByRole('button', { name: '概要を生成' }));

		expect(screen.getByRole('button', { name: '生成中…' })).toHaveProperty('disabled', true);
		expect(await screen.findByRole('button', { name: '概要を生成' })).toBeTruthy();
		expect(generateSessionSummary).toHaveBeenCalledWith({ id: 's1' });
		expect(useTimelineStore.getState().dataVersion).toBe(1);
	});

	it('Claude CLI が使えないときは理由を表示し、データは取り直さない', async () => {
		generateSessionSummary.mockResolvedValue({
			status: 'unavailable',
			reason: 'Claude CLI が見つかりません',
		});
		render(<GenerateSummaryButton sessionId="s1" />);

		fireEvent.click(screen.getByRole('button', { name: '概要を生成' }));

		expect(await screen.findByText(/Claude CLI が見つかりません/)).toBeTruthy();
		expect(useTimelineStore.getState().dataVersion).toBe(0);
	});

	it('会話の記録がない・生成中のときはその旨を表示する', async () => {
		generateSessionSummary.mockResolvedValueOnce({ status: 'empty' });
		render(<GenerateSummaryButton sessionId="s1" />);

		fireEvent.click(screen.getByRole('button', { name: '概要を生成' }));
		expect(await screen.findByText(/会話の記録がない/)).toBeTruthy();

		generateSessionSummary.mockResolvedValueOnce({ status: 'busy' });
		fireEvent.click(screen.getByRole('button', { name: '概要を生成' }));
		expect(await screen.findByText(/終わるまでお待ちください/)).toBeTruthy();
	});

	it('main でエラーになったら、Electron の前置きを除いて表示する', async () => {
		generateSessionSummary.mockRejectedValue(
			new Error(
				"Error invoking remote method 'sessions:generate-summary': SessionNotFoundError: セッションが見つかりません: s1",
			),
		);
		render(<GenerateSummaryButton sessionId="s1" />);

		fireEvent.click(screen.getByRole('button', { name: '概要を生成' }));

		expect((await screen.findByText(/セッションが見つかりません/)).textContent).toBe(
			'セッションが見つかりません: s1',
		);
	});
});
