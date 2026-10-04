// @vitest-environment jsdom
import { ConversationMarkdown } from '@/features/session-detail/components/conversation-markdown';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
	cleanup();
});

describe('ConversationMarkdown', () => {
	it('見出し・強調・リスト・コード・表を Markdown として表示する', () => {
		const { container } = render(
			<ConversationMarkdown
				text={[
					'## 変更点',
					'',
					'**太字** と `code`',
					'',
					'- 一つ目',
					'- 二つ目',
					'',
					'```ts',
					'const a = 1;',
					'```',
					'',
					'| 列 | 値 |',
					'| --- | --- |',
					'| a | 1 |',
				].join('\n')}
			/>,
		);

		expect(container.querySelector('h2')?.textContent).toBe('変更点');
		expect(container.querySelector('strong')?.textContent).toBe('太字');
		expect(container.querySelectorAll('li')).toHaveLength(2);
		expect(container.querySelector('pre code')?.textContent).toContain('const a = 1;');
		expect(container.querySelector('td')?.textContent).toBe('a');
	});

	it('HTML は要素にせず、リンクと画像は外部に通信しない形で表示する', () => {
		const { container } = render(
			<ConversationMarkdown
				text={'<b>生の HTML</b> [サイト](https://example.com) ![図](https://example.com/a.png)'}
			/>,
		);

		expect(container.querySelector('b')).toBeNull();
		expect(container.querySelector('a')).toBeNull();
		expect(container.querySelector('img')).toBeNull();
		expect(container.textContent).toContain('サイト');
		expect(container.textContent).toContain('[画像: 図]');
	});

	it('ユーザーの発言は改行をそのまま改行にし、Claude の発言では Markdown の規則に従う', () => {
		const user = render(<ConversationMarkdown text={'一行目\n二行目'} isUser />);
		expect(user.container.querySelector('br')).not.toBeNull();
		cleanup();
		const assistant = render(<ConversationMarkdown text={'一行目\n二行目'} />);
		expect(assistant.container.querySelector('br')).toBeNull();
	});

	it('「5~10秒」のような範囲の表記は打ち消し線にしない', () => {
		const { container } = render(
			<ConversationMarkdown text={'処理は5~10秒、待機は20~30秒、~~取り消し~~'} />,
		);
		expect(container.querySelectorAll('del')).toHaveLength(1);
		expect(container.querySelector('del')?.textContent).toBe('取り消し');
		expect(container.textContent).toContain('5~10秒');
	});

	it('URL の直書きや javascript: のリンクも、押せる要素にしない', () => {
		const { container } = render(
			<ConversationMarkdown text={'https://example.com と [危険](javascript:alert(1))'} />,
		);
		expect(container.querySelector('a')).toBeNull();
		expect(container.innerHTML).not.toContain('javascript:');
	});

	it('脚注の id は発言をまたいで重ならない', () => {
		const text = '本文[^1]\n\n[^1]: 注';
		const { container } = render(
			<>
				<ConversationMarkdown text={text} />
				<ConversationMarkdown text={text} />
			</>,
		);
		const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
		expect(ids.length).toBeGreaterThan(0);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
