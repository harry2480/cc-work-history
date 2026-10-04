import type { SettingsDto } from '../../../../shared/ipc-contract';
import type { GetAppSettingsUseCase } from '../../application/usecases/get-app-settings.usecase';

export type DataPaths = {
	logDirectory: string;
	databasePath: string;
};

/** 設定画面に表示する、データの場所と設定値を取得する */
export function loadSettings(useCase: GetAppSettingsUseCase, paths: DataPaths): SettingsDto {
	return { ...paths, ...useCase.execute() };
}
