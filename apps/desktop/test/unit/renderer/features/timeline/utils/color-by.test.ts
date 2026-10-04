import { colorGroupOf, legendOf } from '@/features/timeline/utils/color-by';
import { NEUTRAL_COLOR, STATUS_COLORS, paletteColor } from '@/lib/config/palette';
import type { TimelineSessionDto } from '@shared/ipc-contract';
import { describe, expect, it } from 'vitest';

function session(overrides: Partial<TimelineSessionDto> = {}): TimelineSessionDto {
	return {
		id: 's1',
		project: { id: 'p1', name: 'app', path: '/repo/app' },
		startedAt: '',
		endedAt: '',
		status: 'completed',
		totalTokens: 0,
		messageCount: 0,
		summary: null,
		tags: [],
		activities: [],
		...overrides,
	};
}

describe('colorGroupOf', () => {
	it('プロジェクトで色分けすると、プロジェクト ID から色を選ぶ', () => {
		expect(colorGroupOf(session(), 'project')).toEqual({
			key: 'project:p1',
			label: 'app',
			color: paletteColor('p1'),
		});
	});

	it('タグで色分けすると最初のタグの色にし、大文字小文字は区別しない', () => {
		const group = colorGroupOf(session({ tags: ['README', 'docs'] }), 'tag');

		expect(group).toEqual({ key: 'tag:readme', label: '#README', color: paletteColor('readme') });
		expect(colorGroupOf(session({ tags: ['readme'] }), 'tag').color).toBe(group.color);
	});

	it('タグのないセッションは「タグなし」の色', () => {
		expect(colorGroupOf(session(), 'tag')).toEqual({
			key: 'tag:none',
			label: 'タグなし',
			color: NEUTRAL_COLOR,
		});
	});

	it('ステータスで色分けすると、進行中と完了で色を分ける', () => {
		expect(colorGroupOf(session({ status: 'active' }), 'status')).toMatchObject({
			label: '進行中',
			color: STATUS_COLORS.active,
		});
		expect(colorGroupOf(session(), 'status').color).toBe(STATUS_COLORS.completed);
	});
});

describe('legendOf', () => {
	it('重複を除いてラベル順に並べ、「タグなし」は最後にする', () => {
		const sessions = [
			session({ id: 'a', tags: [] }),
			session({ id: 'b', tags: ['zeta'] }),
			session({ id: 'c', tags: ['alpha', 'zeta'] }),
			session({ id: 'd', tags: ['zeta'] }),
		];

		expect(legendOf(sessions, 'tag').map((g) => g.label)).toEqual(['#alpha', '#zeta', 'タグなし']);
	});
});
