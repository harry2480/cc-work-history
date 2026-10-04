import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportResult } from '../../../../../../src/main/backend/application/usecases/import-session-logs.usecase';
import {
	type SessionsChangedEvent,
	WatchSessionLogsUseCase,
} from '../../../../../../src/main/backend/application/usecases/watch-session-logs.usecase';
import { StubLogWatcherAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/stub-log-watcher.adapter';

const emptyResult: ImportResult = {
	scanned: 0,
	imported: 0,
	unchanged: 0,
	empty: 0,
	failures: [],
	importedSessions: [],
};

const t = (min: number) => new Date(Date.UTC(2026, 9, 1, 9, min));

function setup(importResult: Partial<ImportResult> = {}) {
	const watcher = new StubLogWatcherAdapter();
	const importSessionLogs = {
		execute: vi.fn(
			async (_options: { projectIds?: readonly string[]; shouldStop?: () => boolean }) => ({
				...emptyResult,
				...importResult,
			}),
		),
	};
	const events: SessionsChangedEvent[] = [];
	const useCase = new WatchSessionLogsUseCase(watcher, importSessionLogs, (e) => events.push(e), {
		debounceMs: 1000,
	});
	useCase.start();
	return { watcher, importSessionLogs, events, useCase };
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('WatchSessionLogsUseCase', () => {
	it('短時間に続いた変更をまとめ、変わったプロジェクトだけを 1 回で取り込む', async () => {
		const { watcher, importSessionLogs } = setup();

		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		await vi.advanceTimersByTimeAsync(500);
		watcher.emit({ projectId: 'p2', path: '/l/p2/b.jsonl' });
		await vi.advanceTimersByTimeAsync(500);
		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		expect(importSessionLogs.execute).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1000);
		expect(importSessionLogs.execute).toHaveBeenCalledTimes(1);
		expect(importSessionLogs.execute).toHaveBeenCalledWith(
			expect.objectContaining({ projectIds: ['p1', 'p2'] }),
		);
	});

	it('取り込んだセッションの ID と期間を通知する', async () => {
		const { watcher, events } = setup({
			importedSessions: [
				{ id: 's1', startedAt: t(10), endedAt: t(20) },
				{ id: 's2', startedAt: t(0), endedAt: t(15) },
			],
		});

		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		await vi.advanceTimersByTimeAsync(1000);

		expect(events).toEqual([{ sessionIds: ['s1', 's2'], from: t(0), to: t(20) }]);
	});

	it('変わったセッションがなければ通知しない', async () => {
		const { watcher, events } = setup();

		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		await vi.advanceTimersByTimeAsync(1000);

		expect(events).toEqual([]);
	});

	it('取り込み中に届いた変更は、完了後にまとめて取り込む', async () => {
		const { watcher, importSessionLogs } = setup();
		let finishFirst: (r: ImportResult) => void = () => {};
		importSessionLogs.execute.mockImplementationOnce(
			() =>
				new Promise<ImportResult>((resolve) => {
					finishFirst = resolve;
				}),
		);

		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		await vi.advanceTimersByTimeAsync(1000);
		watcher.emit({ projectId: 'p2', path: '/l/p2/b.jsonl' });
		await vi.advanceTimersByTimeAsync(1000);
		expect(importSessionLogs.execute).toHaveBeenCalledTimes(1);

		finishFirst(emptyResult);
		await vi.advanceTimersByTimeAsync(1000);
		expect(importSessionLogs.execute).toHaveBeenCalledTimes(2);
		expect(importSessionLogs.execute).toHaveBeenLastCalledWith(
			expect.objectContaining({ projectIds: ['p2'] }),
		);
	});

	it('取り込みに失敗しても監視を続ける', async () => {
		const { watcher, importSessionLogs } = setup();
		importSessionLogs.execute.mockRejectedValueOnce(new Error('boom'));

		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		await vi.advanceTimersByTimeAsync(1000);
		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		await vi.advanceTimersByTimeAsync(1000);

		expect(importSessionLogs.execute).toHaveBeenCalledTimes(2);
	});

	it('stop で監視を止め、待機中の取り込みも行わない', async () => {
		const { watcher, importSessionLogs, useCase } = setup();

		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		await useCase.stop();
		await vi.advanceTimersByTimeAsync(2000);

		expect(watcher.isWatching).toBe(false);
		expect(importSessionLogs.execute).not.toHaveBeenCalled();
	});

	describe('importAll', () => {
		it('すべてのプロジェクトを取り込んで通知し、結果を返す', async () => {
			const { importSessionLogs, events, useCase } = setup({
				imported: 1,
				importedSessions: [{ id: 's1', startedAt: t(0), endedAt: t(10) }],
			});

			const result = await useCase.importAll();

			expect(result.imported).toBe(1);
			expect(importSessionLogs.execute).toHaveBeenCalledWith(
				expect.not.objectContaining({ projectIds: expect.anything() }),
			);
			expect(events).toEqual([{ sessionIds: ['s1'], from: t(0), to: t(10) }]);
		});

		it('差分取り込みの途中なら、終わってから始める', async () => {
			const { watcher, importSessionLogs, useCase } = setup();
			let finishDiff: (result: ImportResult) => void = () => {};
			importSessionLogs.execute.mockImplementationOnce(
				() =>
					new Promise<ImportResult>((resolve) => {
						finishDiff = resolve;
					}),
			);
			watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
			await vi.advanceTimersByTimeAsync(1000);
			expect(importSessionLogs.execute).toHaveBeenCalledTimes(1);

			const all = useCase.importAll();
			await vi.advanceTimersByTimeAsync(0);
			expect(importSessionLogs.execute).toHaveBeenCalledTimes(1);

			finishDiff(emptyResult);
			await all;
			expect(importSessionLogs.execute).toHaveBeenLastCalledWith(
				expect.not.objectContaining({ projectIds: expect.anything() }),
			);
		});

		it('取り込み中に届いた変更は、取り込みが終わってから差分取り込みする', async () => {
			const { watcher, importSessionLogs, useCase } = setup();
			let finishAll: (result: ImportResult) => void = () => {};
			importSessionLogs.execute.mockImplementationOnce(
				() =>
					new Promise<ImportResult>((resolve) => {
						finishAll = resolve;
					}),
			);
			const all = useCase.importAll();
			watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
			await vi.advanceTimersByTimeAsync(1000);
			expect(importSessionLogs.execute).toHaveBeenCalledTimes(1);

			finishAll(emptyResult);
			await all;
			await vi.advanceTimersByTimeAsync(1000);
			expect(importSessionLogs.execute).toHaveBeenLastCalledWith(
				expect.objectContaining({ projectIds: ['p1'] }),
			);
		});

		it('続けて呼ぶと順番に実行する', async () => {
			const { importSessionLogs, useCase } = setup();
			let running = 0;
			let maxRunning = 0;
			importSessionLogs.execute.mockImplementation(async () => {
				running++;
				maxRunning = Math.max(maxRunning, running);
				await Promise.resolve();
				running--;
				return emptyResult;
			});

			await Promise.all([useCase.importAll(), useCase.importAll(), useCase.importAll()]);

			expect(importSessionLogs.execute).toHaveBeenCalledTimes(3);
			expect(maxRunning).toBe(1);
		});

		it('失敗したら呼び出し元に投げ、その後の差分取り込みは続けられる', async () => {
			const { watcher, importSessionLogs, useCase } = setup();
			importSessionLogs.execute.mockRejectedValueOnce(new Error('boom'));

			await expect(useCase.importAll()).rejects.toThrow('boom');

			watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
			await vi.advanceTimersByTimeAsync(1000);
			expect(importSessionLogs.execute).toHaveBeenLastCalledWith(
				expect.objectContaining({ projectIds: ['p1'] }),
			);
		});

		it('停止後は取り込まずにエラーにする', async () => {
			const { importSessionLogs, useCase } = setup();
			await useCase.stop();

			await expect(useCase.importAll()).rejects.toThrow('終了処理中');
			expect(importSessionLogs.execute).not.toHaveBeenCalled();
		});

		it('停止は実行中の取り込みの完了を待つ', async () => {
			const { importSessionLogs, useCase } = setup();
			let finishAll: (result: ImportResult) => void = () => {};
			importSessionLogs.execute.mockImplementationOnce(
				() =>
					new Promise<ImportResult>((resolve) => {
						finishAll = resolve;
					}),
			);
			const all = useCase.importAll();
			let stopped = false;
			const stopping = useCase.stop().then(() => {
				stopped = true;
			});
			await vi.advanceTimersByTimeAsync(0);
			expect(stopped).toBe(false);

			finishAll(emptyResult);
			await all;
			await stopping;
			expect(stopped).toBe(true);
		});
	});

	it('終了処理が始まったら、実行中の取り込みに打ち切りを伝える', async () => {
		const { importSessionLogs, useCase } = setup();
		let shouldStop: (() => boolean) | undefined;
		let finish: (result: ImportResult) => void = () => {};
		importSessionLogs.execute.mockImplementationOnce(
			(options: { shouldStop?: () => boolean }) =>
				new Promise<ImportResult>((resolve) => {
					shouldStop = options.shouldStop;
					finish = resolve;
				}),
		);
		const all = useCase.importAll();
		await vi.advanceTimersByTimeAsync(0);
		expect(shouldStop?.()).toBe(false);

		const stopping = useCase.stop();
		expect(shouldStop?.()).toBe(true);
		finish(emptyResult);
		await all;
		await stopping;
	});

	it('監視のエラーは onError に渡す', () => {
		const watcher = new StubLogWatcherAdapter();
		const errors: unknown[] = [];
		const useCase = new WatchSessionLogsUseCase(
			watcher,
			{ execute: vi.fn(async () => emptyResult) },
			() => {},
			{ onError: (error) => errors.push(error) },
		);
		useCase.start();

		watcher.fail(new Error('EMFILE'));

		expect(errors).toEqual([new Error('EMFILE')]);
	});

	it('差分取り込みが失敗したら、同じプロジェクトを再試行する（3 回まで）', async () => {
		const { watcher, importSessionLogs } = setup();
		importSessionLogs.execute.mockRejectedValue(new Error('SQLITE_BUSY'));

		watcher.emit({ projectId: 'p1', path: '/l/p1/a.jsonl' });
		await vi.advanceTimersByTimeAsync(1000);
		expect(importSessionLogs.execute).toHaveBeenCalledTimes(1);

		for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(1000);

		// 最初の 1 回 + 再試行 3 回
		expect(importSessionLogs.execute).toHaveBeenCalledTimes(4);
		expect(importSessionLogs.execute).toHaveBeenLastCalledWith(
			expect.objectContaining({ projectIds: ['p1'] }),
		);
	});
});
