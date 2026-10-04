import {
	DEFAULT_IDLE_THRESHOLD_MINUTES,
	MAX_IDLE_THRESHOLD_MINUTES,
	MIN_IDLE_THRESHOLD_MINUTES,
} from '../../domain/models/app-settings.model';
import type { AppSettingsRepository } from '../../domain/repositories/app-settings.repository';

export type AppSettingsView = {
	idleThresholdMinutes: number;
	defaultIdleThresholdMinutes: number;
	minIdleThresholdMinutes: number;
	maxIdleThresholdMinutes: number;
};

/** 保存済みのアプリの設定を、指定できる範囲と合わせて取得する */
export class GetAppSettingsUseCase {
	constructor(private readonly appSettingsRepository: AppSettingsRepository) {}

	execute(): AppSettingsView {
		return {
			idleThresholdMinutes: this.appSettingsRepository.get().idleThresholdMinutes,
			defaultIdleThresholdMinutes: DEFAULT_IDLE_THRESHOLD_MINUTES,
			minIdleThresholdMinutes: MIN_IDLE_THRESHOLD_MINUTES,
			maxIdleThresholdMinutes: MAX_IDLE_THRESHOLD_MINUTES,
		};
	}
}
