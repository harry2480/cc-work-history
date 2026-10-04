import { cn } from '@/lib/utils/cn';
import { memo, useId } from 'react';
import Markdown, { type Components, type Options } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

/**
 * HTML はそのまま描画しない（react-markdown の既定）。外部への通信を増やさないため、
 * リンクは押せない文字として、画像は代わりのテキストとして表示する
 */
const COMPONENTS: Components = {
	a: ({ href, children }) => (
		<span className="underline decoration-dotted" title={href}>
			{children}
		</span>
	),
	// 脚注の見出しは clobberPrefix が効かず、どの発言でも id="footnote-label" になるため id を外す
	h2: ({ node: _node, id, ...props }) => (
		<h2 {...props} id={id === 'footnote-label' ? undefined : id} />
	),
	section: ({ node: _node, ...props }) => {
		const { 'aria-labelledby': labelledBy, ...rest } = props as typeof props & {
			'aria-labelledby'?: string;
		};
		return (
			<section
				{...rest}
				aria-labelledby={labelledBy === 'footnote-label' ? undefined : labelledBy}
			/>
		);
	},
	img: ({ alt, src }) => (
		<span className="text-muted-foreground" title={typeof src === 'string' ? src : undefined}>
			[画像{alt ? `: ${alt}` : ''}]
		</span>
	),
};

// 「5~10秒」のような範囲の表記を打ち消し線にしない（~~x~~ は打ち消し線のまま）
type PluggableList = NonNullable<Options['remarkPlugins']>;
const GFM: PluggableList[number] = [remarkGfm, { singleTilde: false }];
const PLUGINS: PluggableList = [GFM];
const PLUGINS_WITH_BREAKS: PluggableList = [GFM, remarkBreaks];

const STYLES = cn(
	'min-w-0 break-words text-sm leading-relaxed',
	'[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
	'[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5',
	'[&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-bold',
	'[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-bold',
	'[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-bold [&_h4]:mt-2 [&_h4]:font-bold',
	'[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
	'[&_hr]:my-3',
	'[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
	'[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3',
	'[&_pre_code]:bg-transparent [&_pre_code]:p-0',
	'[&_table]:my-2 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-xs',
	'[&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1',
);
/** コードの背景。吹き出しの背景（ユーザーは muted）と区別できる色にする */
const CODE_BACKGROUND = {
	plain: '[&_code]:bg-muted [&_pre]:bg-muted',
	onMuted: '[&_code]:bg-card [&_pre]:bg-card',
} as const;

type Props = {
	text: string;
	/** ユーザーの発言は改行をそのまま改行として扱い、muted の吹き出しに置く */
	isUser?: boolean;
};

/** 会話の発言を Markdown として表示する。発言は変わらないので、ダイアログの再描画で解析し直さない */
export const ConversationMarkdown = memo(function ConversationMarkdown({
	text,
	isUser = false,
}: Props) {
	// 脚注の id が発言をまたいで重ならないよう、発言ごとに接頭辞を変える
	const idPrefix = useId();
	return (
		<div className={cn(STYLES, isUser ? CODE_BACKGROUND.onMuted : CODE_BACKGROUND.plain)}>
			<Markdown
				remarkPlugins={isUser ? PLUGINS_WITH_BREAKS : PLUGINS}
				remarkRehypeOptions={{ clobberPrefix: `${idPrefix}-`, footnoteLabel: '脚注' }}
				components={COMPONENTS}
			>
				{text}
			</Markdown>
		</div>
	);
});
