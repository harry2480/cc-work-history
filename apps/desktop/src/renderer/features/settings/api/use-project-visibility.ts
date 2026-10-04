import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import { useFilterStore } from '@/stores/filter-store';
import { useTimelineStore } from '@/stores/timeline-store';
import type { ProjectVisibilityDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useRef, useState } from 'react';

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
	const selectSession = useTimelineStore((s) => s.selectSession);
	const removeProjectFromFilter = useFilterStore((s) => s.removeProject);
	// 古い応答が後から届いても、新しい一覧を上書きしないようにする
	const latestRequest = useRef(0);

	const load = useCallback(async () => {
		const request = ++latestRequest.current;
		try {
			const data = await window.api.getProjectVisibility();
			if (request !== latestRequest.current) return;
			setData(data);
			setError(null);
		} catch (e) {
			if (request === latestRequest.current) setError(ipcErrorMessage(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	// 取り込みで新しいプロジェクトが増えたら取り直す
	useEffect(() => window.api.onSessionsChanged(() => void load()), [load]);

	const setHidden = useCallback(
		async (projectId: string, hidden: boolean) => {
			await window.api.updateProjectVisibility({ projectId, hidden });
			if (hidden) {
				// 選択肢から消えるプロジェクトで絞り込んだままだと、結果が空のまま戻せなくなる
				removeProjectFromFilter(projectId);
				// 選んでいたセッションが非表示のプロジェクトのものかもしれないので、詳細パネルを閉じる
				selectSession(null);
			}
			await load();
			// タイムライン・一覧・ダッシュボード・絞り込みの選択肢を取り直す
			notifyDataChanged();
		},
		[load, notifyDataChanged, removeProjectFromFilter, selectSession],
	);

	return { data, error, setHidden };
}
