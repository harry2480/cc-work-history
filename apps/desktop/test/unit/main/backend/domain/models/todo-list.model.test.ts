import { describe, expect, it } from 'vitest';
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
