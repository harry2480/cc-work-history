import { Button } from '@/components/ui/button';
import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { useTimelineStore } from '@/stores/timeline-store';
import type { GenerateSummaryResultDto } from '@shared/ipc-contract';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';

const MESSAGES: Record<Exclude<GenerateSummaryResultDto['status'], 'ok'>, string> = {
	busy: 'このセッションの概要を生成しています。終わるまでお待ちください。',
	empty: '会話の記録がないため、生成できませんでした。',
	unavailable: '生成できませんでした',
	failed: '生成に失敗しました',
};

/** Claude CLI でセッションの概要とタグを生成する。手で編集した概要と手で付けたタグは残る */
export function GenerateSummaryButton({ sessionId }: { sessionId: string }) {
	const notifyDataChanged = useTimelineStore((s) => s.notifyDataChanged);
	// パネルを開き直しても生成中だと分かるよう、store に持つ
	const generating = useTimelineStore((s) => s.generatingSummaryIds.includes(sessionId));
	const setGenerating = useTimelineStore((s) => s.setGeneratingSummary);
	const [error, setError] = useState<string | null>(null);

	const generate = async () => {
		setGenerating(sessionId, true);
		setError(null);
		try {
			const result = await window.api.generateSessionSummary({ id: sessionId });
			if (result.status === 'ok') {
				// 詳細パネル・タイムライン・絞り込みの選択肢を取り直す
				notifyDataChanged();
			} else if (result.status === 'unavailable' || result.status === 'failed') {
				setError(`${MESSAGES[result.status]}: ${result.reason}`);
			} else {
				setError(MESSAGES[result.status]);
			}
		} catch (e) {
			setError(ipcErrorMessage(e));
		} finally {
			setGenerating(sessionId, false);
		}
	};

	return (
		<div className="flex flex-col items-end gap-1">
			<Button variant="ghost" size="sm" onClick={generate} disabled={generating}>
				<Sparkles />
				{generating ? '生成中…' : '概要を生成'}
			</Button>
			<output aria-live="polite" className="max-w-64 text-right text-xs text-destructive">
				{error}
			</output>
		</div>
	);
}
