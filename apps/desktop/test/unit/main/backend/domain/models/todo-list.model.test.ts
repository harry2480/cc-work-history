import { describe, expect, it } from 'vitest';
import type { LoggedTodoEvent } from '../../../../../../src/main/backend/domain/models/session-log-entry.model';
import {
	MAX_TODO_CONTENT_LENGTH,
	MAX_TODO_ITEMS,
	TodoItem,
	TodoList,
} from '../../../../../../src/main/backend/domain/models/todo-list.model';

const contents = (list: TodoList) => list.items.map((t) => [t.content, t.status]);

describe('TodoItem.create', () => {
	it('内容の前後の空白を除いて作る', () => {
		const result = TodoItem.create({ content: '  テストを書く ', status: 'in_progress' });

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.value.content).toBe('テストを書く');
		expect(result.value.status).toBe('in_progress');
	});

	it.each([
		[{ content: '   ', status: 'pending' }, 'EMPTY_CONTENT'],
		[{ content: 'a'.repeat(MAX_TODO_CONTENT_LENGTH + 1), status: 'pending' }, 'CONTENT_TOO_LONG'],
		[{ content: 'a', status: 'done' }, 'INVALID_STATUS'],
	])('不正な値はエラーにする（%o）', (input, error) => {
		expect(TodoItem.create(input)).toEqual({ success: false, error });
	});

	it('上限ちょうどの長さは作れる（サロゲートペアは 1 文字として数える）', () => {
		expect(
			TodoItem.create({ content: '😀'.repeat(MAX_TODO_CONTENT_LENGTH), status: 'pending' }).success,
		).toBe(true);
	});
});

describe('TodoList.create', () => {
	it('保存済みの値から順番どおりに復元する', () => {
		const result = TodoList.create([
			{ content: 'a', status: 'completed' },
			{ content: 'b', status: 'pending' },
		]);

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(contents(result.value)).toEqual([
			['a', 'completed'],
			['b', 'pending'],
		]);
	});

	it('不正な項目や多すぎる項目はエラーにする', () => {
		expect(TodoList.create([{ content: 'a', status: 'x' }])).toEqual({
			success: false,
			error: 'INVALID_STATUS',
		});
		const tooMany = Array.from({ length: MAX_TODO_ITEMS + 1 }, (_, i) => ({
			content: `t${i}`,
			status: 'pending',
		}));
		expect(TodoList.create(tooMany)).toEqual({ success: false, error: 'TOO_MANY_ITEMS' });
	});
});

describe('TodoList.fromLogged', () => {
	it('不正な項目は捨てて、残りを順番どおりに使う', () => {
		const list = TodoList.fromLogged([
			{ content: 'a', status: 'completed' },
			{ content: '', status: 'pending' },
			{ content: 'b', status: 'unknown' },
			{ content: 'c', status: 'in_progress' },
		]);

		expect(contents(list)).toEqual([
			['a', 'completed'],
			['c', 'in_progress'],
		]);
	});

	it('長すぎる内容は上限の長さに切り詰める', () => {
		const [item] = TodoList.fromLogged([
			{ content: 'あ'.repeat(MAX_TODO_CONTENT_LENGTH + 10), status: 'pending' },
		]).items;

		expect(item ? [...item.content].length : 0).toBe(MAX_TODO_CONTENT_LENGTH);
		expect(item?.content.endsWith('…')).toBe(true);
	});

	it('項目数は上限で打ち切る', () => {
		const list = TodoList.fromLogged(
			Array.from({ length: MAX_TODO_ITEMS + 5 }, (_, i) => ({
				content: `t${i}`,
				status: 'pending',
			})),
		);

		expect(list.items).toHaveLength(MAX_TODO_ITEMS);
		expect(list.items.at(-1)?.content).toBe(`t${MAX_TODO_ITEMS - 1}`);
	});

	it('空のリストからは空のチェックリストを作る', () => {
		expect(TodoList.fromLogged([]).items).toEqual([]);
		expect(TodoList.empty().items).toEqual([]);
	});
});

describe('TodoList.fromLogEvents', () => {
	const write = (...items: [string, string][]): LoggedTodoEvent => ({
		kind: 'todo-write',
		todos: items.map(([content, status]) => ({ content, status })),
	});
	const create = (taskId: string, subject: string): LoggedTodoEvent => ({
		kind: 'task-create',
		taskId,
		subject,
	});
	const update = (
		taskId: string,
		fields: { status?: string; subject?: string } = {},
	): LoggedTodoEvent => ({ kind: 'task-update', taskId, ...fields });

	it('操作がなければ空にする', () => {
		expect(TodoList.fromLogEvents([]).items).toEqual([]);
	});

	it('TodoWrite は最後の呼び出しの内容を使い、空のリストなら空にする', () => {
		expect(
			contents(TodoList.fromLogEvents([write(['a', 'pending']), write(['a', 'completed'])])),
		).toEqual([['a', 'completed']]);
		expect(contents(TodoList.fromLogEvents([write(['a', 'pending']), write()]))).toEqual([]);
	});

	it('TaskCreate は pending で作成順に並べ、TaskUpdate の状態と件名を反映する', () => {
		const list = TodoList.fromLogEvents([
			create('1', 'a'),
			create('2', 'b'),
			create('3', 'c'),
			update('2', { status: 'in_progress' }),
			update('1', { status: 'completed', subject: 'a（改名）' }),
		]);

		expect(contents(list)).toEqual([
			['a（改名）', 'completed'],
			['b', 'in_progress'],
			['c', 'pending'],
		]);
	});

	it('deleted のタスクは除き、未知の状態や空の件名は無視して他の更新は反映する', () => {
		const list = TodoList.fromLogEvents([
			create('1', 'a'),
			create('2', 'b'),
			update('1', { status: 'deleted' }),
			update('2', { status: 'blocked', subject: 'b2' }),
			update('2', { subject: '  ' }),
		]);

		expect(contents(list)).toEqual([['b2', 'pending']]);
	});

	it('作成されていない ID への TaskUpdate は無視する', () => {
		const list = TodoList.fromLogEvents([
			update('9', { status: 'completed' }),
			create('1', 'a'),
			update('2', { status: 'completed' }),
		]);

		expect(contents(list)).toEqual([['a', 'pending']]);
	});

	it('すべて完了した後に作成されたら、片付けられたものとして完了済みのタスクを除く（ID の振り直し）', () => {
		const list = TodoList.fromLogEvents([
			create('1', 'a'),
			create('2', 'b'),
			update('1', { status: 'completed' }),
			update('2', { status: 'completed' }),
			create('1', 'c'),
		]);

		expect(contents(list)).toEqual([['c', 'pending']]);
	});

	it('未完了のタスクが残っていれば、新しいタスクは末尾に追加する', () => {
		const list = TodoList.fromLogEvents([
			create('1', 'a'),
			create('2', 'b'),
			update('1', { status: 'completed' }),
			create('3', 'c'),
		]);

		expect(contents(list)).toEqual([
			['a', 'completed'],
			['b', 'pending'],
			['c', 'pending'],
		]);
	});

	it('両方の方式が混ざっていたら、最後に有効な操作をした方式の状態を使う', () => {
		expect(contents(TodoList.fromLogEvents([write(['w', 'pending']), create('1', 't')]))).toEqual([
			['t', 'pending'],
		]);
		expect(
			contents(TodoList.fromLogEvents([create('1', 't'), write(['w', 'in_progress'])])),
		).toEqual([['w', 'in_progress']]);
		// 無視された TaskUpdate では方式を切り替えない
		expect(
			contents(TodoList.fromLogEvents([create('1', 't'), write(['w', 'pending']), update('9')])),
		).toEqual([['w', 'pending']]);
	});

	it('タスクの件名も上限で切り詰め、項目数も上限で打ち切る', () => {
		const list = TodoList.fromLogEvents(
			Array.from({ length: MAX_TODO_ITEMS + 1 }, (_, i) =>
				create(String(i), 'あ'.repeat(MAX_TODO_CONTENT_LENGTH + 1)),
			),
		);

		expect(list.items).toHaveLength(MAX_TODO_ITEMS);
		expect([...(list.items[0]?.content ?? '')].length).toBe(MAX_TODO_CONTENT_LENGTH);
	});
});
