import { Badge } from '@/components/ui/badge';
import { formatDateTime, formatDuration, formatInteger, formatTime } from '@/lib/utils/format';
import { useTimelineStore } from '@/stores/timeline-store';
import type { SessionDetailDto } from '@shared/ipc-contract';
import type { ReactNode } from 'react';
import { useSessionDetail } from '../api/use-session-detail';
import { AnnotationSection } from './annotation-section';

export function SessionDetailPanel() {
	const sessionId = useTimelineStore((s) => s.selectedSessionId);
	const { data, loading, error } = useSessionDetail(sessionId);

	if (!sessionId) {
		return (
			<Placeholder title="セッション詳細">
				タイムラインでセッションを選ぶと、ここに詳細を表示します。
			</Placeholder>
		);
	}
	if (error) {
		return (
			<Placeholder title="セッション詳細">
				<span role="alert" className="text-destructive">
					詳細を読み込めませんでした: {error}
				</span>
			</Placeholder>
		);
	}
	if (!data) {
		return (
			<Placeholder title="セッション詳細">
				{loading ? '読み込み中…' : 'セッションが見つかりませんでした。'}
			</Placeholder>
		);
	}
	return <SessionDetail detail={data} />;
}

function SessionDetail({ detail }: { detail: SessionDetailDto }) {
	const startedAt = new Date(detail.startedAt);
	const endedAt = new Date(detail.endedAt);

	return (
		<div className="flex flex-col gap-6">
			<header>
				<div className="flex items-center gap-2">
					<h2 className="text-lg font-bold">{detail.project.name}</h2>
					{detail.status === 'active' ? (
						<Badge>● 進行中</Badge>
					) : (
						<Badge variant="secondary">完了</Badge>
					)}
				</div>
				<p className="mt-1 break-all text-xs text-muted-foreground">{detail.project.path}</p>
			</header>

			<AnnotationSection key={detail.id} detail={detail} />

			<Section title="基本情報">
				<Field label="開始">{formatDateTime(startedAt)}</Field>
				<Field label="終了">{formatDateTime(endedAt)}</Field>
				<Field label="活動時間">
					{formatDuration(detail.activeDurationMs)}
					<span className="ml-1 text-xs text-muted-foreground">（放置時間を除く）</span>
				</Field>
				<Field label="作業ディレクトリ">
					<span className="break-all">{detail.cwd ?? '—'}</span>
				</Field>
				<Field label="モデル">{detail.models.length > 0 ? detail.models.join(', ') : '—'}</Field>
			</Section>

			<Section title="使用量">
				<Field label="メッセージ">{formatInteger(detail.messageCount)}</Field>
				<Field label="入力トークン">{formatInteger(detail.inputTokens)}</Field>
				<Field label="出力トークン">{formatInteger(detail.outputTokens)}</Field>
				<Field label="合計トークン">{formatInteger(detail.totalTokens)}</Field>
			</Section>

			<Section title={`活動区間（${detail.activities.length}）`}>
				<ul className="flex flex-col gap-1 text-sm">
					{detail.activities.map((activity) => {
						const from = new Date(activity.startedAt);
						const to = new Date(activity.endedAt);
						return (
							<li key={activity.startedAt} className="flex justify-between gap-2">
								<span>
									{formatDateTime(from)}〜{formatTime(to)}
								</span>
								<span className="text-muted-foreground">
									{formatDuration(to.getTime() - from.getTime())}
								</span>
							</li>
						);
					})}
				</ul>
			</Section>
		</div>
	);
}

function Placeholder({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div>
			<h2 className="text-lg font-bold">{title}</h2>
			<p className="mt-2 text-sm text-muted-foreground">{children}</p>
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section>
			<h3 className="mb-2 text-sm font-bold text-muted-foreground">{title}</h3>
			<dl className="flex flex-col gap-1">{children}</dl>
		</section>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd>{children}</dd>
		</div>
	);
}
