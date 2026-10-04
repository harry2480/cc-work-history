import { describe, expect, it, vi } from 'vitest';
import {
	InvalidAppSettingsError,
	UpdateIdleThresholdUseCase,
} from '../../../../../../src/main/backend/application/usecases/update-idle-threshold.usecase';
import { AppSettings } from '../../../../../../src/main/backend/domain/models/app-settings.model';
import type { AppSettingsRepository } from '../../../../../../src/main/backend/domain/repositories/app-settings.repository';

class InMemoryAppSettingsRepository implements AppSettingsRepository {
	settings = AppSettings.default();
	get() {
		return this.settings;
	}
	save(settings: AppSettings) {
		this.settings = settings;
	}
}

function setup() {
	const repository = new InMemoryAppSettingsRepository();
	const order: string[] = [];
	const importAll = vi.fn(async (): Promise<{ failures: unknown[] }> => {
		order.push(`import:${repository.get().idleThresholdMinutes}`);
		return { failures: [] };
	});
	const useCase = new UpdateIdleThresholdUseCase(repository, { importAll });
	return { repository, importAll, useCase, order };
}

describe('UpdateIdleThresholdUseCase', () => {
	it('閾値を保存してから、すべてのプロジェクトを取り込む', async () => {
		const { repository, useCase, order } = setup();

		expect(await useCase.execute(10)).toEqual({ failedFiles: 0 });

		expect(repository.get().idleThresholdMinutes).toBe(10);
		expect(order).toEqual(['import:10']);
	});

	it('同じ値でも取り込む（前回の再計算が失敗していたら残りを計算し直すため）', async () => {
		const { importAll, useCase } = setup();

		await useCase.execute(30);

		expect(importAll).toHaveBeenCalledTimes(1);
	});

	it('取り込めなかったファイルの数を返す', async () => {
		const { importAll, useCase } = setup();
		importAll.mockResolvedValue({ failures: [{}, {}] });

		expect(await useCase.execute(10)).toEqual({ failedFiles: 2 });
	});

	it('取り込みに失敗したら投げる（閾値は保存済みで、次の取り込みで計算し直される）', async () => {
		const { repository, importAll, useCase } = setup();
		importAll.mockRejectedValue(new Error('boom'));

		await expect(useCase.execute(10)).rejects.toThrow('boom');
		expect(repository.get().idleThresholdMinutes).toBe(10);
	});

	it('範囲外の値は保存せずにエラーにする', async () => {
		const { repository, importAll, useCase } = setup();

		await expect(useCase.execute(0)).rejects.toThrow(InvalidAppSettingsError);
		await expect(useCase.execute(241)).rejects.toThrow('1〜240 分');

		expect(repository.get().idleThresholdMinutes).toBe(30);
		expect(importAll).not.toHaveBeenCalled();
	});
});
