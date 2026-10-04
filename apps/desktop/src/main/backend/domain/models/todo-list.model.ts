import type { Result } from './result.model';
import type { LoggedTodo } from './session-log-entry.model';

export const MAX_TODO_CONTENT_LENGTH = 500;
export const MAX_TODO_ITEMS = 100;

export const TODO_STATUSES = ['pending', 'in_progress', 'completed'] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

export type TodoItemError = 'EMPTY_CONTENT' | 'CONTENT_TOO_LONG' | 'INVALID_STATUS';
export type TodoListError = 'TOO_MANY_ITEMS' | TodoItemError;

/** 作業状況チェックリストの 1 項目 */
export class TodoItem {
	private constructor(
		readonly content: string,
		readonly status: TodoStatus,
	) {}

	static create(input: { content: string; status: string }): Result<TodoItem, TodoItemError> {
		const content = input.content.trim();
		if (!content) return { success: false, error: 'EMPTY_CONTENT' };
		if ([...content].length > MAX_TODO_CONTENT_LENGTH) {
			return { success: false, error: 'CONTENT_TOO_LONG' };
		}
		if (!isTodoStatus(input.status)) return { success: false, error: 'INVALID_STATUS' };
		return { success: true, value: new TodoItem(content, input.status) };
	}
}

/**
 * セッションの作業状況チェックリスト。
 * Claude Code の TodoWrite ツールは呼び出しのたびにリスト全体を書き込むため、セッション中の最後の呼び出しの内容を使う。
 * ログから取り込む読み取り専用の情報で、ユーザーは編集しない
 */
export class TodoList {
	private constructor(readonly items: readonly TodoItem[]) {}

	static empty(): TodoList {
		return new TodoList([]);
	}

	/** 保存済みの値から復元する */
	static create(
		items: readonly { content: string; status: string }[],
	): Result<TodoList, TodoListError> {
		if (items.length > MAX_TODO_ITEMS) return { success: false, error: 'TOO_MANY_ITEMS' };
		const created: TodoItem[] = [];
		for (const input of items) {
			const item = TodoItem.create(input);
			if (!item.success) return item;
			created.push(item.value);
		}
		return { success: true, value: new TodoList(created) };
	}

	/**
	 * ログに記録された TodoWrite の内容から組み立てる。
	 * ログの形式は変わりうるため、不正な項目は捨て、長すぎる内容は切り詰め、項目数は上限で打ち切る
	 */
	static fromLogged(todos: readonly LoggedTodo[]): TodoList {
		const items: TodoItem[] = [];
		for (const todo of todos) {
			if (items.length >= MAX_TODO_ITEMS) break;
			const item = TodoItem.create({
				content: truncate(todo.content.trim(), MAX_TODO_CONTENT_LENGTH),
				status: todo.status,
			});
			if (item.success) items.push(item.value);
		}
		return new TodoList(items);
	}
}

function isTodoStatus(value: string): value is TodoStatus {
	return (TODO_STATUSES as readonly string[]).includes(value);
}

function truncate(value: string, maxLength: number): string {
	const chars = [...value];
	return chars.length > maxLength ? `${chars.slice(0, maxLength - 1).join('')}…` : value;
}
