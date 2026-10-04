import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { useTimelineStore } from '@/stores/timeline-store';
import type { ProjectVisibilityDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useState } from 'react';

type ProjectVisibilityState = {
	data: ProjectVisibilityDto[] | null;
	error: string | null;
	/** 非表示にする・表示に戻す。失敗したら投げる */
	setHidden: (projectId: string, hidden: boolean) => Promise<void>;
};

/** すべてのプロジェクトと、非表示にしているか */
export function useProjectVisibility(): ProjectVisibilityState {
	const [data, setData] = useState<ProjectVisibilityDto[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const notifyDataChanged = useTimelineStore((s) => s.notifyDataChanged);

	const load = useCallback(async () => {
		try {
			setData(await window.api.getProjectVisibility());
			setError(null);
		} catch (e) {
			setError(ipcErrorMessage(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const setHidden = useCallback(
		async (projectId: string, hidden: boolean) => {
			await window.api.updateProjectVisibility({ projectId, hidden });
			await load();
			// タイムライン・一覧・ダッシュボード・絞り込みの選択肢を取り直す
			notifyDataChanged();
		},
		[load, notifyDataChanged],
	);

	return { data, error, setHidden };
}
