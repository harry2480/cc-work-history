import {
	AppSettings,
	MAX_IDLE_THRESHOLD_MINUTES,
	MIN_IDLE_THRESHOLD_MINUTES,
} from '../../domain/models/app-settings.model';
import type { AppSettingsRepository } from '../../domain/repositories/app-settings.repository';

/** すべてのプロジェクトを取り込む。閾値が変わったファイルは活動区間を計算し直す */
type ImportAllSessionLogs = {
	importAll(): Promise<{ failures: readonly unknown[] }>;
};

export type UpdateIdleThresholdResult = {
	/** 取り込めず、古い活動区間のまま残ったファイルの数 */
	failedFiles: number;
};

/** 入力が不正なとき（ドメインの不変条件に反するとき）のエラー */
export class InvalidAppSettingsError extends Error {
	override name = 'InvalidAppSettingsError';
}

/**
 * 活動区間を分ける無操作時間の閾値を変更し、活動区間を計算し直す（完了まで待つ）。
 * 取り込み済みのファイルには計算したときの閾値が記録されているため、
 * 再計算が途中で失敗しても、次の取り込み（起動時など）で残りが計算し直される
 */
export class UpdateIdleThresholdUseCase {
	constructor(
		private readonly appSettingsRepository: AppSettingsRepository,
		private readonly sessionLogs: ImportAllSessionLogs,
	) {}

	async execute(idleThresholdMinutes: number): Promise<UpdateIdleThresholdResult> {
		const next = AppSettings.create({ idleThresholdMinutes });
		if (!next.success) {
			throw new InvalidAppSettingsError(
				`閾値は ${MIN_IDLE_THRESHOLD_MINUTES}〜${MAX_IDLE_THRESHOLD_MINUTES} 分の整数で指定してください`,
			);
		}
		this.appSettingsRepository.save(next.value);
		// 同じ値でも呼ぶ。前回の再計算が失敗していたら、ここで残りが計算し直される
		const result = await this.sessionLogs.importAll();
		return { failedFiles: result.failures.length };
	}
}
