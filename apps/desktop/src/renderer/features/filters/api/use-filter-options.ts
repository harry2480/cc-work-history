import { useTimelineStore } from '@/stores/timeline-store';
import type { FilterOptionsDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useRef, useState } from 'react';

/** 絞り込みの選択肢。セッションやタグが変わったら取り直す */
export function useFilterOptions(): FilterOptionsDto {
	const [options, setOptions] = useState<FilterOptionsDto>({ projects: [], tags: [] });
	const dataVersion = useTimelineStore((s) => s.dataVersion);

	// 古い応答が後から届いても、新しい選択肢を上書きしないようにする
	const latestRequest = useRef(0);

	const load = useCallback(async () => {
		const request = ++latestRequest.current;
		try {
			const options = await window.api.getFilterOptions();
			if (request === latestRequest.current) setOptions(options);
		} catch {
			// 選択肢が取れなくてもタイムラインは使えるので、前の選択肢のままにする
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: dataVersion が変わったら取り直す
	useEffect(() => {
		void load();
	}, [load, dataVersion]);

	useEffect(() => window.api.onSessionsChanged(() => void load()), [load]);

	return options;
}
