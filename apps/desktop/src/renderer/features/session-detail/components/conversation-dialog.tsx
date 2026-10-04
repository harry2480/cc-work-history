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
import { useState } from 'react';
import { useSessionConversation } from '../api/use-session-conversation';

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

	return (
		<Dialog open={open} onOpenChange={setOpen}>
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
				{open && <ConversationBody sessionId={sessionId} />}
			</DialogContent>
		</Dialog>
	);
}

function ConversationBody({ sessionId }: { sessionId: string }) {
	const { data, loading, error } = useSessionConversation(sessionId);

	if (error) {
		return (
			<p role="alert" className="text-sm text-destructive">
				会話を読み込めませんでした: {error}
			</p>
		);
	}
	if (!data) {
		return (
			<p className="text-sm text-muted-foreground">
				{loading ? '読み込み中…' : 'セッションが見つかりませんでした。'}
			</p>
		);
	}
	if (data.status === 'missing') {
		return <p className="text-sm text-muted-foreground">ログファイルが見つかりませんでした。</p>;
	}
	if (data.messages.length === 0) {
		return <p className="text-sm text-muted-foreground">会話の記録がありません。</p>;
	}
	return (
		<div className="flex min-h-0 flex-col gap-2">
			<p className="text-xs text-muted-foreground">{formatInteger(data.messages.length)} 件</p>
			<ol className="-mx-2 flex min-h-0 flex-col gap-3 overflow-y-auto px-2">
				{data.messages.map((message, index) => (
					// 発言は並び替わらず、同じ文の発言もあるため位置をキーにする
					// biome-ignore lint/suspicious/noArrayIndexKey: 読み取り専用の固定リスト
					<MessageItem key={index} message={message} />
				))}
			</ol>
		</div>
	);
}

function MessageItem({ message }: { message: ConversationMessageDto }) {
	const isUser = message.role === 'user';
	return (
		<li className={cn('flex flex-col gap-1', isUser && 'items-end')}>
			<span className="text-xs font-bold text-muted-foreground">{ROLE_LABELS[message.role]}</span>
			<div
				className={cn(
					'max-w-full whitespace-pre-wrap break-words rounded-card px-3 py-2 text-sm',
					isUser ? 'bg-muted' : 'border',
				)}
			>
				{message.text}
			</div>
		</li>
	);
}
