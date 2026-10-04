// @vitest-environment jsdom
import { CopyMarkdownButton } from '@/features/session-detail/components/copy-markdown-button';
import { sessionToMarkdown } from '@/features/session-detail/utils/to-markdown';
import type { SessionDetailDto } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const at = (hour: number) => new Date(2026, 9, 1, hour).toISOString();

const detail: SessionDetailDto = {
	id: 's1',
	project: { id: 'p1', name: 'app', path: '/Users/me/repo/app' },
	cwd: null,
	startedAt: at(9),
	endedAt: at(10),
	activeDurationMs: 60 * 60_000,
	status: 'completed',
	inputTokens: 0,
	outputTokens: 0,
	totalTokens: 0,
	messageCount: 1,
	models: [],
	summary: '概要',
	summaryEditedManually: false,
	tags: [{ name: 'docs', source: 'manual' }],
	activities: [],
};

let writeText: ReturnType<typeof vi.fn<(text: string) => Promise<void>>>;

beforeEach(() => {
	writeText = vi.fn(async () => {});
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('CopyMarkdownButton', () => {
	it('クリックで Markdown をクリップボードにコピーし、コピーしたことを知らせる', async () => {
		render(<CopyMarkdownButton detail={detail} />);

		fireEvent.click(screen.getByRole('button', { name: 'Markdown でコピー' }));

		expect(await screen.findByText('コピーしました')).toBeTruthy();
		expect(writeText).toHaveBeenCalledWith(sessionToMarkdown(detail));
	});

	it('しばらくするとお知らせを消す', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		render(<CopyMarkdownButton detail={detail} />);

		fireEvent.click(screen.getByRole('button', { name: 'Markdown でコピー' }));
		expect(await screen.findByText('コピーしました')).toBeTruthy();

		await vi.advanceTimersByTimeAsync(2000);
		expect(screen.queryByText('コピーしました')).toBeNull();
	});

	it('続けて押すと、お知らせを出す時間を最後に押したときから数え直す', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		render(<CopyMarkdownButton detail={detail} />);
		const button = screen.getByRole('button', { name: 'Markdown でコピー' });

		fireEvent.click(button);
		expect(await screen.findByText('コピーしました')).toBeTruthy();
		await vi.advanceTimersByTimeAsync(1500);
		fireEvent.click(button);
		await vi.advanceTimersByTimeAsync(1000);

		expect(screen.queryByText('コピーしました')).toBeTruthy();
		expect(writeText).toHaveBeenCalledTimes(2);
	});

	it('コピーに失敗したらその旨を表示する', async () => {
		writeText.mockRejectedValue(new Error('denied'));
		render(<CopyMarkdownButton detail={detail} />);

		fireEvent.click(screen.getByRole('button', { name: 'Markdown でコピー' }));

		expect(await screen.findByText('コピーできませんでした')).toBeTruthy();
	});
});
