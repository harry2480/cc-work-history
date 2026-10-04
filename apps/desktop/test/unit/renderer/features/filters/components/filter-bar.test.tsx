// @vitest-environment jsdom
import { FilterBar } from '@/features/filters/components/filter-bar';
import { useFilterStore } from '@/stores/filter-store';
import type { DesktopApi } from '@shared/ipc-contract';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
	useFilterStore.getState().clear();
	window.api = {
		getFilterOptions: vi.fn(async () => ({
			projects: [{ id: 'p1', name: 'app', path: '/repo/app' }],
			tags: ['docs'],
		})),
		onSessionsChanged: () => () => {},
	} as unknown as DesktopApi;
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('FilterBar', () => {
	it('選択肢を表示し、チェックするとストアの条件が変わる', async () => {
		render(<FilterBar />);

		fireEvent.click(await screen.findByLabelText('app'));
		fireEvent.click(screen.getByLabelText('#docs'));

		expect(useFilterStore.getState()).toMatchObject({ projectIds: ['p1'], tags: ['docs'] });
		expect(screen.getAllByText('（1）', { selector: 'span' })).toHaveLength(2);
	});

	it('キーワードは入力が止まってから条件に反映する', async () => {
		vi.useFakeTimers();
		render(<FilterBar />);

		fireEvent.change(screen.getByLabelText('概要を検索'), { target: { value: '誤字' } });
		expect(useFilterStore.getState().query).toBe('');

		await act(() => vi.advanceTimersByTimeAsync(300));
		expect(useFilterStore.getState().query).toBe('誤字');
	});

	it('条件があるときだけクリアボタンを出し、押すと条件と入力欄を空にする', async () => {
		render(<FilterBar />);
		expect(screen.queryByRole('button', { name: '条件をクリア' })).toBeNull();

		act(() => useFilterStore.setState({ tags: ['docs'], query: 'x' }));
		fireEvent.click(await screen.findByRole('button', { name: '条件をクリア' }));

		expect(useFilterStore.getState()).toMatchObject({ projectIds: [], tags: [], query: '' });
		expect((screen.getByLabelText('概要を検索') as HTMLInputElement).value).toBe('');
	});
});
