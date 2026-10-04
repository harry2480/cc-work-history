import { toFilterDto, useFilterStore } from '@/stores/filter-store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
	useFilterStore.getState().clear();
});

describe('filter-store', () => {
	it('プロジェクトとタグの選択を切り替える', () => {
		const { toggleProject, toggleTag } = useFilterStore.getState();
		toggleProject('p1');
		toggleProject('p2');
		toggleProject('p1');
		toggleTag('docs');

		expect(useFilterStore.getState()).toMatchObject({ projectIds: ['p2'], tags: ['docs'] });
	});

	it('toFilterDto は未指定の条件を送らず、キーワードの前後の空白を除く', () => {
		expect(toFilterDto({ projectIds: [], tags: [], query: '  ' })).toEqual({});
		expect(toFilterDto({ projectIds: ['p1'], tags: ['a'], query: ' 誤字 ' })).toEqual({
			projectIds: ['p1'],
			tags: ['a'],
			query: '誤字',
		});
	});
});
