import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { useTimelineStore } from '@/stores/timeline-store';
import type { SessionDetailDto } from '@shared/ipc-contract';
import { Pencil } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { GenerateSummaryButton } from './generate-summary-button';

type Props = {
	detail: SessionDetailDto;
};

/** 入力欄のタグ（カンマ・読点・改行区切り）を一覧にする */
export function parseTagInput(input: string): string[] {
	return input
		.split(/[,、\n]/)
		.map((tag) => tag.trim())
		.filter(Boolean);
}

/** 概要とタグの表示と、手動での編集 */
export function AnnotationSection({ detail }: Props) {
	const [editing, setEditing] = useState(false);
	// 生成中に編集を開くと、どちらかの結果が消えるため開かせない
	const generating = useTimelineStore((s) => s.generatingSummaryIds.includes(detail.id));

	return (
		<section>
			<div className="mb-2 flex items-start justify-between">
				<h3 className="text-sm font-bold text-muted-foreground">概要・タグ</h3>
				{!editing && (
					<div className="flex items-start gap-1">
						<GenerateSummaryButton sessionId={detail.id} />
						<Button
							variant="ghost"
							size="sm"
							disabled={generating}
							onClick={() => setEditing(true)}
						>
							<Pencil />
							編集
						</Button>
					</div>
				)}
			</div>
			{editing ? (
				<AnnotationForm detail={detail} onDone={() => setEditing(false)} />
			) : (
				<AnnotationView detail={detail} />
			)}
		</section>
	);
}

function AnnotationView({ detail }: Props) {
	return (
		<div className="flex flex-col gap-2 text-sm">
			{detail.summary ? (
				<p className="whitespace-pre-wrap">
					{detail.summary}
					{detail.summaryEditedManually && (
						<Badge variant="outline" className="ml-2 align-middle">
							手動編集
						</Badge>
					)}
				</p>
			) : (
				<p className="text-muted-foreground">概要はまだありません。</p>
			)}
			{detail.tags.length > 0 ? (
				<ul aria-label="タグ" className="flex flex-wrap gap-1">
					{detail.tags.map((tag) => (
						<li key={tag.name}>
							<Badge variant={tag.source === 'manual' ? 'secondary' : 'outline'}>#{tag.name}</Badge>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground">タグはありません。</p>
			)}
		</div>
	);
}

function AnnotationForm({ detail, onDone }: Props & { onDone: () => void }) {
	const notifyDataChanged = useTimelineStore((s) => s.notifyDataChanged);
	const [summary, setSummary] = useState(detail.summary ?? '');
	const [tags, setTags] = useState(detail.tags.map((tag) => tag.name).join(', '));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			await window.api.updateSessionAnnotation({
				id: detail.id,
				summary: summary.trim() || null,
				tags: parseTagInput(tags),
			});
			notifyDataChanged();
			onDone();
		} catch (e) {
			setError(ipcErrorMessage(e));
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={submit} className="flex flex-col gap-3">
			<div className="flex flex-col gap-1">
				<Label htmlFor="annotation-summary">概要</Label>
				<Textarea
					id="annotation-summary"
					value={summary}
					onChange={(e) => setSummary(e.target.value)}
					maxLength={1000}
					rows={4}
				/>
			</div>
			<div className="flex flex-col gap-1">
				<Label htmlFor="annotation-tags">タグ（カンマ区切り）</Label>
				<Input id="annotation-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
			</div>
			{error && (
				<p role="alert" className="text-sm text-destructive">
					保存できませんでした: {error}
				</p>
			)}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={onDone} disabled={saving}>
					キャンセル
				</Button>
				<Button type="submit" disabled={saving}>
					{saving ? '保存中…' : '保存'}
				</Button>
			</div>
		</form>
	);
}
