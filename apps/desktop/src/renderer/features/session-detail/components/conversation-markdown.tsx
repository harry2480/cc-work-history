import { cn } from '@/lib/utils/cn';
import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

/**
 * 会話の発言を Markdown として表示する。
 * HTML はそのまま描画しない（react-markdown の既定）。外部への通信を増やさないため、
 * リンクは押せない文字として、画像は代わりのテキストとして表示する
 */
const COMPONENTS: Components = {
	a: ({ href, children }) => (
		<span className="underline decoration-dotted" title={href}>
			{children}
		</span>
	),
	img: ({ alt, src }) => (
		<span className="text-muted-foreground" title={typeof src === 'string' ? src : undefined}>
			[画像{alt ? `: ${alt}` : ''}]
		</span>
	),
};

const STYLES = cn(
	'min-w-0 break-words text-sm leading-relaxed',
	'[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
	'[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5',
	'[&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold',
	'[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold',
	'[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-bold [&_h4]:mt-2 [&_h4]:font-bold',
	'[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
	'[&_hr]:my-3',
	'[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
	'[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3',
	'[&_pre_code]:bg-transparent [&_pre_code]:p-0',
	'[&_table]:my-2 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-xs',
	'[&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1',
);

type Props = {
	text: string;
	/** ユーザーの発言は改行をそのまま改行として扱う */
	preserveLineBreaks?: boolean;
};

/** 発言は変わらないので、ダイアログの再描画で解析し直さない */
export const ConversationMarkdown = memo(function ConversationMarkdown({
	text,
	preserveLineBreaks = false,
}: Props) {
	return (
		<div className={STYLES}>
			<Markdown
				remarkPlugins={preserveLineBreaks ? [remarkGfm, remarkBreaks] : [remarkGfm]}
				components={COMPONENTS}
			>
				{text}
			</Markdown>
		</div>
	);
});
