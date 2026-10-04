import { Button } from '@/components/ui/button';
import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { SquareTerminal } from 'lucide-react';
import { useState } from 'react';

type Feedback = { kind: 'ok' } | { kind: 'error'; message: string };

/** ターミナルを開いて `claude -r` でセッションを再開する */
export function ResumeSessionButton({ sessionId }: { sessionId: string }) {
	const [opening, setOpening] = useState(false);
	const [feedback, setFeedback] = useState<Feedback | null>(null);

	const resume = async () => {
		setOpening(true);
		setFeedback(null);
		try {
			const result = await window.api.resumeSession({ id: sessionId });
			setFeedback(
				result.status === 'ok' ? { kind: 'ok' } : { kind: 'error', message: result.reason },
			);
		} catch (e) {
			setFeedback({ kind: 'error', message: ipcErrorMessage(e) });
		} finally {
			setOpening(false);
		}
	};

	return (
		<div className="flex flex-col gap-1">
			<Button variant="outline" size="sm" onClick={resume} disabled={opening}>
				<SquareTerminal />
				ターミナルで再開
			</Button>
			<output aria-live="polite" className="text-xs">
				{feedback?.kind === 'ok' && (
					<span className="text-muted-foreground">ターミナルを開きました。</span>
				)}
				{feedback?.kind === 'error' && <span className="text-destructive">{feedback.message}</span>}
			</output>
		</div>
	);
}
