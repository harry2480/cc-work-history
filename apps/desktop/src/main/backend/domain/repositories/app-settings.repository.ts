import type { AppSettings } from '../models/app-settings.model';

export interface AppSettingsRepository {
	/** 保存済みの設定。未保存の項目や壊れた値は既定値にする */
	get(): AppSettings;
	save(settings: AppSettings): void;
}
