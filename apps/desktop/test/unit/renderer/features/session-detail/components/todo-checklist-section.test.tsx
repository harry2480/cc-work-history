// @vitest-environment jsdom
import { TodoChecklistSection } from '@/features/session-detail/components/todo-checklist-section';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
	cleanup();
});

describe('TodoChecklistSection', () => {
	it('項目を順番どおりに、状態を読み上げ用のラベル付きで表示する', () => {
		render(
			<TodoChecklistSection
				todos={[
					{ content: 'テストを書く', status: 'completed' },
					{ content: '実装する', status: 'in_progress' },
					{ content: 'レビューする', status: 'pending' },
				]}
			/>,
		);

		const list = screen.getByRole('list', { name: '作業状況チェックリスト' });
		expect(
			within(list)
				.getAllByRole('listitem')
				.map((li) => li.textContent),
		).toEqual(['完了: テストを書く', '進行中: 実装する', '未着手: レビューする']);
		expect(screen.getByRole('heading', { name: /作業状況/ }).textContent).toContain('1/3 完了');
	});

	it('読み取り専用で、チェックボックスや編集ボタンを出さない', () => {
		render(<TodoChecklistSection todos={[{ content: '実装する', status: 'pending' }]} />);

		expect(screen.queryByRole('checkbox')).toBeNull();
		expect(screen.queryByRole('button')).toBeNull();
		expect(screen.queryByRole('textbox')).toBeNull();
	});

	it('項目がなければ、タスクの記録がないことを表示する', () => {
		render(<TodoChecklistSection todos={[]} />);

		expect(screen.queryByRole('list')).toBeNull();
		expect(screen.getByText('このセッションにはタスクの記録がありません。')).toBeTruthy();
		expect(screen.getByRole('heading', { name: '作業状況' })).toBeTruthy();
	});
});
