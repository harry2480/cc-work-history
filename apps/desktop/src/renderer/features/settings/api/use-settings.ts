import { ipcErrorMessage } from '@/lib/utils/ipc-error';
import type { SettingsDto, UpdateIdleThresholdResultDto } from '@shared/ipc-contract';
import { useCallback, useEffect, useState } from 'react';

type SettingsState = {
	data: SettingsDto | null;
	error: string | null;
	/** 閾値を変更し、活動区間の再計算が終わるまで待つ。失敗したら投げる */
	updateIdleThreshold: (minutes: number) => Promise<UpdateIdleThresholdResultDto>;
};

/** main が持つ設定（データの場所・活動区間の閾値） */
export function useSettings(): SettingsState {
	const [data, setData] = useState<SettingsDto | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		try {
			setData(await window.api.getSettings());
			setError(null);
		} catch (e) {
			setError(ipcErrorMessage(e));
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const updateIdleThreshold = useCallback(
		async (minutes: number) => {
			// 計算し直したセッションは main から変更通知が届き、タイムラインなどはそれで取り直す
			const result = await window.api.updateIdleThreshold({ minutes });
			await load();
			return result;
		},
		[load],
	);

	return { data, error, updateIdleThreshold };
}
