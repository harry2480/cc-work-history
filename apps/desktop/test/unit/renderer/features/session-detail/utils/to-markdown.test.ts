import { sessionToMarkdown } from '@/features/session-detail/utils/to-markdown';
import type { SessionDetailDto } from '@shared/ipc-contract';
import { describe, expect, it } from 'vitest';

const at = (day: number, hour: number, min = 0) => new Date(2026, 9, day, hour, min).toISOString();

function detail(overrides: Partial<SessionDetailDto> = {}): SessionDetailDto {
	return {
		id: 's1',
		project: { id: 'p1', name: 'app', path: '/Users/me/repo/app' },
		cwd: null,
		startedAt: at(1, 9),
		endedAt: at(1, 10, 30),
		activeDurationMs: 85 * 60_000,
		status: 'completed',
		inputTokens: 1_000,
		outputTokens: 234,
		totalTokens: 1_234,
		messageCount: 12,
		models: [],
		summary: null,
		summaryEditedManually: false,
		tags: [],
		activities: [],
		todos: [],
		...overrides,
	};
}

describe('sessionToMarkdown', () => {
	it('プロジェクト名・日時・活動時間・概要・タグを Markdown にする', () => {
		const markdown = sessionToMarkdown(
			detail({
				summary: 'README の誤字を直した',
				tags: [
					{ name: 'docs', source: 'manual' },
					{ name: 'fix', source: 'auto' },
				],
			}),
		);

		expect(markdown).toBe(
			[
				'### app（2026/10/1(木) 09:00〜10:30・1時間 25分）',
				'',
				'README の誤字を直した',
				'',
				'タグ: #docs #fix',
				'',
				'- プロジェクト: `/Users/me/repo/app`',
				'- メッセージ: 12 / トークン: 1,234',
				'',
			].join('\n'),
		);
	});

	it('概要とタグがなければその行を出さない', () => {
		const markdown = sessionToMarkdown(detail());

		expect(markdown).not.toContain('タグ:');
		expect(markdown.split('\n')).toEqual([
			'### app（2026/10/1(木) 09:00〜10:30・1時間 25分）',
			'',
			'- プロジェクト: `/Users/me/repo/app`',
			'- メッセージ: 12 / トークン: 1,234',
			'',
		]);
	});

	it('日をまたぐセッションは終了側にも日付を付ける', () => {
		const markdown = sessionToMarkdown(detail({ startedAt: at(1, 23), endedAt: at(2, 1) }));

		expect(markdown).toContain('2026/10/1(木) 23:00〜2026/10/2(金) 01:00');
	});

	it('タグ名の空白や記号はハッシュタグが切れないように _ にする', () => {
		const markdown = sessionToMarkdown(
			detail({
				tags: [
					{ name: 'code review', source: 'manual' },
					{ name: 'c++', source: 'manual' },
					{ name: '設計/DB', source: 'auto' },
				],
			}),
		);

		expect(markdown).toContain('タグ: #code_review #c_ #設計/DB');
	});

	it('パスにバッククォートがあってもコードスパンが途中で閉じない', () => {
		const markdown = sessionToMarkdown(
			detail({ project: { id: 'p1', name: 'app', path: '/tmp/a`b' } }),
		);

		expect(markdown).toContain('- プロジェクト: `` /tmp/a`b ``');
	});
});
