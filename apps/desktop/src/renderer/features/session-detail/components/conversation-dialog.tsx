import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';
import { formatInteger } from '@/lib/utils/format';
import type { ConversationMessageDto } from '@shared/ipc-contract';
import { MessagesSquare } from 'lucide-react';
import { type RefObject, useRef, useState } from 'react';
import { useSessionConversation } from '../api/use-session-conversation';
import { useNearViewport } from '../hooks/use-near-viewport';
import { ConversationMarkdown } from './conversation-markdown';

const ROLE_LABELS = { user: 'あなた', assistant: 'Claude' } as const;

/** セッションの会話（ユーザーとアシスタントの発言）をダイアログで表示する */
export function ConversationDialog({
	sessionId,
	projectName,
}: {
	sessionId: string;
	projectName: string;
}) {
	const [open, setOpen] = useState(false);
	// 閉じるアニメーションの間も中身を残す（開くまではログを読まない）
	const [opened, setOpened] = useState(false);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setOpened(true);
			}}
		>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<MessagesSquare />
					会話を表示
				</Button>
			</DialogTrigger>
			<DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>会話 — {projectName}</DialogTitle>
					<DialogDescription>
						ツールの入出力・思考・サブエージェントの発言は表示しません。
					</DialogDescription>
				</DialogHeader>
				{opened && <ConversationBody sessionId={sessionId} />}
			</DialogContent>
		</Dialog>
	);
}

function ConversationBody({ sessionId }: { sessionId: string }) {
	const { data, loading, error } = useSessionConversation(sessionId);
	const listRef = useRef<HTMLOListElement>(null);

	if (error) {
		return (
			<p role="alert" className="text-sm text-destructive">
				会話を読み込めませんでした: {error}
			</p>
		);
	}
	if (!data) {
		return <Status>{loading ? '読み込み中…' : 'セッションが見つかりませんでした。'}</Status>;
	}
	if (data.status === 'missing') {
		return <Status>ログファイルが見つかりませんでした。</Status>;
	}
	if (data.messages.length === 0) {
		return <Status>会話の記録がありません。</Status>;
	}
	return (
		<div className="flex min-h-0 flex-col gap-2">
			<p className="text-xs text-muted-foreground">
				{formatInteger(data.messages.length)} 件
				{data.truncated && '（古い発言や長い発言の一部を省いています）'}
			</p>
			<ol
				ref={listRef}
				// biome-ignore lint/a11y/noNoninteractiveTabindex: キーボードでスクロールできるようにする
				tabIndex={0}
				aria-label="会話の発言"
				className="-mx-2 flex min-h-0 flex-col gap-3 overflow-y-auto px-2"
			>
				{data.messages.map((message, index) => (
					// 発言は並び替わらず、同じ文の発言もあるため位置をキーにする
					// biome-ignore lint/suspicious/noArrayIndexKey: 読み取り専用の固定リスト
					<MessageItem key={index} message={message} listRef={listRef} />
				))}
			</ol>
		</div>
	);
}

function MessageItem({
	message,
	listRef,
}: {
	message: ConversationMessageDto;
	listRef: RefObject<HTMLOListElement | null>;
}) {
	const isUser = message.role === 'user';
	// Markdown の解析は重いので、画面に近づくまでは平文で出す（長い会話でも開いた直後に固まらない）
	const [ref, near] = useNearViewport<HTMLLIElement>(listRef);
	return (
		<li
			ref={ref}
			className={cn('flex flex-col gap-1 [content-visibility:auto]', isUser && 'items-end')}
		>
			<span className="text-xs font-bold text-muted-foreground">{ROLE_LABELS[message.role]}</span>
			<div
				className={cn('min-w-0 max-w-full rounded-card px-3 py-2', isUser ? 'bg-muted' : 'border')}
			>
				{near ? (
					<ConversationMarkdown text={message.text} isUser={isUser} />
				) : (
					<p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.text}</p>
				)}
			</div>
		</li>
	);
}

function Status({ children }: { children: string }) {
	return <output className="block text-sm text-muted-foreground">{children}</output>;
}
