// @vitest-environment jsdom
import {
	AnnotationSection,
	parseTagInput,
} from '@/features/session-detail/components/annotation-section';
import { useTimelineStore } from '@/stores/timeline-store';
import type { DesktopApi, SessionDetailDto } from '@shared/ipc-contract';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function detail(overrides: Partial<SessionDetailDto> = {}): SessionDetailDto {
	return {
		id: 's1',
		project: { id: 'p1', name: 'app', path: '/repo/app' },
		cwd: null,
		startedAt: '2026-10-01T00:00:00.000Z',
		endedAt: '2026-10-01T01:00:00.000Z',
		activeDurationMs: 0,
		status: 'completed',
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		messageCount: 1,
		models: [],
		summary: 'README を直した',
		summaryEditedManually: true,
		tags: [
			{ name: 'docs', source: 'manual' },
			{ name: 'auto-tag', source: 'auto' },
		],
		activities: [],
		todos: [],
		...overrides,
	};
}

let update: ReturnType<typeof vi.fn<DesktopApi['updateSessionAnnotation']>>;

beforeEach(() => {
	update = vi.fn<DesktopApi['updateSessionAnnotation']>(async () => {});
	window.api = { updateSessionAnnotation: update } as unknown as DesktopApi;
	useTimelineStore.setState({ dataVersion: 0, generatingSummaryIds: [] });
});

afterEach(() => {
	cleanup();
});

describe('parseTagInput', () => {
	it('カンマ・読点・改行で区切り、空白と空の要素を除く', () => {
		expect(parseTagInput(' a, b、c\n , ')).toEqual(['a', 'b', 'c']);
	});
});

describe('AnnotationSection', () => {
	it('概要・手動編集の印・タグを表示する', () => {
		render(<AnnotationSection detail={detail()} />);

		expect(screen.getByText('README を直した')).toBeTruthy();
		expect(screen.getByText('手動編集')).toBeTruthy();
		expect(screen.getByText('#docs')).toBeTruthy();
		expect(screen.getByText('#auto-tag')).toBeTruthy();
	});

	it('概要・タグがなければその旨を表示する', () => {
		render(<AnnotationSection detail={detail({ summary: null, tags: [] })} />);

		expect(screen.getByText('概要はまだありません。')).toBeTruthy();
		expect(screen.getByText('タグはありません。')).toBeTruthy();
	});

	it('編集して保存すると action を呼び、表示中のデータを取り直させる', async () => {
		render(<AnnotationSection detail={detail()} />);
		fireEvent.click(screen.getByRole('button', { name: '編集' }));

		fireEvent.change(screen.getByLabelText('概要'), { target: { value: ' 新しい概要 ' } });
		fireEvent.change(screen.getByLabelText('タグ（カンマ区切り）'), {
			target: { value: 'docs, fix' },
		});
		fireEvent.click(screen.getByRole('button', { name: '保存' }));

		await waitFor(() => expect(screen.queryByRole('button', { name: '保存' })).toBeNull());
		expect(update).toHaveBeenCalledWith({ id: 's1', summary: '新しい概要', tags: ['docs', 'fix'] });
		expect(useTimelineStore.getState().dataVersion).toBe(1);
	});

	it('概要を空にすると null で保存する', async () => {
		render(<AnnotationSection detail={detail()} />);
		fireEvent.click(screen.getByRole('button', { name: '編集' }));
		fireEvent.change(screen.getByLabelText('概要'), { target: { value: '   ' } });
		fireEvent.click(screen.getByRole('button', { name: '保存' }));

		await waitFor(() => expect(update).toHaveBeenCalled());
		expect(update.mock.calls[0]?.[0].summary).toBeNull();
	});

	it('保存に失敗したらエラーを表示し、編集を続けられる', async () => {
		update.mockRejectedValue(new Error('タグが長すぎます'));
		render(<AnnotationSection detail={detail()} />);
		fireEvent.click(screen.getByRole('button', { name: '編集' }));
		fireEvent.click(screen.getByRole('button', { name: '保存' }));

		expect((await screen.findByRole('alert')).textContent).toContain('タグが長すぎます');
		expect(screen.getByRole('button', { name: '保存' })).toBeTruthy();
		expect(useTimelineStore.getState().dataVersion).toBe(0);
	});

	it('キャンセルすると保存せずに表示に戻る', () => {
		render(<AnnotationSection detail={detail()} />);
		fireEvent.click(screen.getByRole('button', { name: '編集' }));
		fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));

		expect(update).not.toHaveBeenCalled();
		expect(screen.getByText('README を直した')).toBeTruthy();
	});

	it('概要の生成中は、手動の編集を開けない', async () => {
		let finish: () => void = () => {};
		window.api = {
			updateSessionAnnotation: vi.fn(),
			generateSessionSummary: vi.fn(
				() =>
					new Promise((resolve) => {
						finish = () => resolve({ status: 'ok' });
					}),
			),
		} as unknown as DesktopApi;
		render(<AnnotationSection detail={detail()} />);

		fireEvent.click(screen.getByRole('button', { name: '概要を生成' }));
		expect(screen.getByRole('button', { name: '編集' })).toHaveProperty('disabled', true);

		finish();
		await waitFor(() =>
			expect(screen.getByRole('button', { name: '編集' })).toHaveProperty('disabled', false),
		);
	});

	it('生成中にパネルを開き直しても、編集は開けないまま', async () => {
		let finish: () => void = () => {};
		window.api = {
			updateSessionAnnotation: vi.fn(),
			generateSessionSummary: vi.fn(
				() =>
					new Promise((resolve) => {
						finish = () => resolve({ status: 'ok' });
					}),
			),
		} as unknown as DesktopApi;
		const { unmount } = render(<AnnotationSection detail={detail()} />);
		fireEvent.click(screen.getByRole('button', { name: '概要を生成' }));
		unmount();

		render(<AnnotationSection detail={detail()} />);
		expect(screen.getByRole('button', { name: '編集' })).toHaveProperty('disabled', true);
		expect(screen.getByRole('button', { name: '生成中…' })).toBeTruthy();

		finish();
		await waitFor(() =>
			expect(screen.getByRole('button', { name: '編集' })).toHaveProperty('disabled', false),
		);
	});
});
