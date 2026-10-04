import type { Result } from './result.model';
import type { LoggedTodo, LoggedTodoEvent } from './session-log-entry.model';

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

/** TaskUpdate でこの状態にされたタスクは一覧から除く */
const DELETED_TASK_STATUS = 'deleted';

/**
 * セッションの作業状況チェックリスト。ログから取り込む読み取り専用の情報で、ユーザーは編集しない。
 * Claude Code の作業リストには 2 つの方式がある:
 * - TodoWrite: 呼び出しのたびにリスト全体を書き込む → 最後の呼び出しの内容を使う
 * - TaskCreate / TaskUpdate: タスク単位で作成・更新する → 記録順にたどった最終状態を使う
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
	 * ログに記録された作業リストの操作（記録順）から、セッション終了時点のチェックリストを組み立てる。
	 *
	 * - 両方の方式が混ざっている場合は、最後に有効な操作をした方式の状態を使う
	 *   （TodoWrite が最後なら最後の TodoWrite の内容、Task 系が最後ならタスクの最終状態）
	 * - タスクは作成順に並べる。状態は作成時 pending で、TaskUpdate の status / subject を反映する
	 * - 既存のタスクがすべて完了した後に作成されたら、リストが片付けられたものとして完了済みのタスクを除く
	 *   （Claude Code はこのとき ID を 1 から振り直す。同じ ID の作成も新しいタスクとして扱う）
	 * - status が deleted のタスクは除き、未知の status は無視する（他のフィールドの更新は反映する）
	 * - 作成されていない ID への TaskUpdate は無視する（他のセッションで作られたタスクなど）
	 */
	static fromLogEvents(events: readonly LoggedTodoEvent[]): TodoList {
		let lastTodoWrite: readonly LoggedTodo[] = [];
		const tasks = new Map<string, LoggedTodo>();
		let latest: 'todo-write' | 'task' | null = null;

		for (const event of events) {
			switch (event.kind) {
				case 'todo-write':
					lastTodoWrite = event.todos;
					latest = 'todo-write';
					break;
				case 'task-create':
					// Claude Code はタスクがすべて完了するとリストを片付け、ID を振り直す
					if (tasks.size > 0 && [...tasks.values()].every((t) => t.status === 'completed')) {
						tasks.clear();
					}
					// 同じ ID で作り直されたら新しいタスクとして末尾に置く
					tasks.delete(event.taskId);
					tasks.set(event.taskId, { content: event.subject, status: 'pending' });
					latest = 'task';
					break;
				case 'task-update': {
					const task = tasks.get(event.taskId);
					if (!task) break;
					if (event.status === DELETED_TASK_STATUS) {
						tasks.delete(event.taskId);
					} else {
						tasks.set(event.taskId, {
							content: event.subject?.trim() ? event.subject : task.content,
							status:
								event.status !== undefined && isTodoStatus(event.status)
									? event.status
									: task.status,
						});
					}
					latest = 'task';
					break;
				}
			}
		}

		if (latest === 'todo-write') return TodoList.fromLogged(lastTodoWrite);
		if (latest === 'task') return TodoList.fromLogged([...tasks.values()]);
		return TodoList.empty();
	}

	/**
	 * ログに記録された作業リストの項目から組み立てる。
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
