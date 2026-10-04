import type { Result } from './result.model';
import { DEFAULT_IDLE_THRESHOLD_MS } from './session.model';

export const MIN_IDLE_THRESHOLD_MINUTES = 1;
export const MAX_IDLE_THRESHOLD_MINUTES = 240;
export const DEFAULT_IDLE_THRESHOLD_MINUTES = DEFAULT_IDLE_THRESHOLD_MS / 60_000;

export type AppSettingsError = 'INVALID_IDLE_THRESHOLD';

/** main プロセスで使うアプリの設定（色やテーマなど表示だけの設定は renderer に保存する） */
export class AppSettings {
	private constructor(readonly idleThresholdMinutes: number) {}

	static default(): AppSettings {
		return new AppSettings(DEFAULT_IDLE_THRESHOLD_MINUTES);
	}

	/**
	 * 活動区間を分ける無操作時間の閾値（分）を指定して作る。
	 * 1〜240 分の整数だけを受け付ける
	 */
	static create(input: { idleThresholdMinutes: number }): Result<AppSettings, AppSettingsError> {
		const minutes = input.idleThresholdMinutes;
		if (
			!Number.isInteger(minutes) ||
			minutes < MIN_IDLE_THRESHOLD_MINUTES ||
			minutes > MAX_IDLE_THRESHOLD_MINUTES
		) {
			return { success: false, error: 'INVALID_IDLE_THRESHOLD' };
		}
		return { success: true, value: new AppSettings(minutes) };
	}

	get idleThresholdMs(): number {
		return this.idleThresholdMinutes * 60_000;
	}
}
