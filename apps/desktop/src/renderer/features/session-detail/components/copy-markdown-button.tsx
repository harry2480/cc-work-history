import { Button } from '@/components/ui/button';
import type { SessionDetailDto } from '@shared/ipc-contract';
import { Check, ClipboardCopy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sessionToMarkdown } from '../utils/to-markdown';

const FEEDBACK_MS = 2000;

/** 押すたびに表示時間を延ばすため、毎回新しいオブジェクトにする */
type Feedback = { status: 'copied' | 'failed' };

/** セッションを Markdown でクリップボードにコピーする */
export function CopyMarkdownButton({ detail }: { detail: SessionDetailDto }) {
	const [feedback, setFeedback] = useState<Feedback | null>(null);

	useEffect(() => {
		if (!feedback) return;
		const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
		return () => clearTimeout(timer);
	}, [feedback]);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(sessionToMarkdown(detail));
			setFeedback({ status: 'copied' });
		} catch {
			setFeedback({ status: 'failed' });
		}
	};

	return (
		<div className="flex items-center gap-2">
			<Button variant="outline" size="sm" onClick={copy}>
				{feedback?.status === 'copied' ? <Check /> : <ClipboardCopy />}
				Markdown でコピー
			</Button>
			<output aria-live="polite" className="text-xs text-muted-foreground">
				{feedback?.status === 'copied' && 'コピーしました'}
				{feedback?.status === 'failed' && (
					<span className="text-destructive">コピーできませんでした</span>
				)}
			</output>
		</div>
	);
}
