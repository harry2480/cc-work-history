import { formatInteger } from '@/lib/utils/format';
import { useSessionResult } from '../api/use-session-result';

/** 成果: セッションの期間中に自分がしたコミットの数と、変更したファイルの数 */
export function SessionResultSection({ sessionId }: { sessionId: string }) {
	const { data, loading, error } = useSessionResult(sessionId);

	return (
		<section aria-busy={loading}>
			<h3 className="mb-2 text-sm font-bold text-muted-foreground">成果（git）</h3>
			<SessionResultBody data={data} loading={loading} error={error} />
		</section>
	);
}

function SessionResultBody({ data, loading, error }: ReturnType<typeof useSessionResult>) {
	if (error) {
		return <p className="text-sm text-destructive">成果を取得できませんでした: {error}</p>;
	}
	if (!data) {
		return <p className="text-sm text-muted-foreground">{loading ? '集計中…' : 'なし'}</p>;
	}
	switch (data.status) {
		case 'commits':
			return (
				<dl className="flex flex-col gap-1 text-sm">
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">コミット</dt>
						<dd>{formatInteger(data.commitCount)}</dd>
					</div>
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">変更したファイル</dt>
						<dd>{formatInteger(data.changedFileCount)}</dd>
					</div>
				</dl>
			);
		case 'no_repository':
			return <p className="text-sm text-muted-foreground">なし（git リポジトリではありません）</p>;
		case 'unavailable':
			return <p className="text-sm text-muted-foreground">集計できませんでした: {data.reason}</p>;
	}
}
