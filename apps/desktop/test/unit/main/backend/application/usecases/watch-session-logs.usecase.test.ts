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
	const importSessionLogs = { execute: vi.fn(async () => ({ ...emptyResult, ...importResult })) };
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
		expect(importSessionLogs.execute).toHaveBeenCalledWith({ projectIds: ['p1', 'p2'] });
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
		expect(importSessionLogs.execute).toHaveBeenLastCalledWith({ projectIds: ['p2'] });
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
});
