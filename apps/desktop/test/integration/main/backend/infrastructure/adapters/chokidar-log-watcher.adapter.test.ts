import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LogFileChange } from '../../../../../../src/main/backend/domain/gateways/log-watcher.gateway';
import { ChokidarLogWatcherAdapter } from '../../../../../../src/main/backend/infrastructure/adapters/chokidar-log-watcher.adapter';

let root: string;
let watcher: ChokidarLogWatcherAdapter;
let changes: LogFileChange[];

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) throw new Error('timeout');
		await new Promise((r) => setTimeout(r, 50));
	}
}

beforeEach(async () => {
	root = mkdtempSync(join(tmpdir(), 'cc-work-history-watch-'));
	mkdirSync(join(root, 'p1'));
	writeFileSync(join(root, 'p1', 'existing.jsonl'), '{}\n');
	changes = [];
	watcher = new ChokidarLogWatcherAdapter(root);
	watcher.start((change) => changes.push(change));
	// chokidar の初期スキャンが終わるのを待つ。直前に作ったファイルのイベントが
	// 開始後に届くことがあるため（実アプリでは差分取り込みが「変更なし」と判定するだけ）、ここで捨てる
	await new Promise((r) => setTimeout(r, 500));
	changes.length = 0;
});

afterEach(async () => {
	await watcher.stop();
	rmSync(root, { recursive: true, force: true });
});

describe('ChokidarLogWatcherAdapter', () => {
	it('既存ファイルは通知せず、JSONL の追加と変更を通知する', async () => {
		writeFileSync(join(root, 'p1', 'new.jsonl'), '{}\n');
		await waitFor(() => changes.length >= 1);
		appendFileSync(join(root, 'p1', 'existing.jsonl'), '{}\n');
		await waitFor(() => changes.some((c) => c.path.endsWith('existing.jsonl')));

		expect(changes).toContainEqual({ projectId: 'p1', path: join(root, 'p1', 'new.jsonl') });
		expect(changes).toContainEqual({ projectId: 'p1', path: join(root, 'p1', 'existing.jsonl') });
	});

	it('新しいプロジェクトのディレクトリ内の JSONL も通知する', async () => {
		mkdirSync(join(root, 'p2'));
		await new Promise((r) => setTimeout(r, 300));
		writeFileSync(join(root, 'p2', 's.jsonl'), '{}\n');

		await waitFor(() => changes.some((c) => c.projectId === 'p2'));
	});

	it('JSONL 以外のファイルとルート直下のファイルは通知しない', async () => {
		writeFileSync(join(root, 'p1', 'notes.txt'), 'x');
		writeFileSync(join(root, 'root.jsonl'), '{}\n');
		writeFileSync(join(root, 'p1', 'marker.jsonl'), '{}\n');
		await waitFor(() => changes.length >= 1);
		await new Promise((r) => setTimeout(r, 300));

		expect(changes.map((c) => c.path)).toEqual([join(root, 'p1', 'marker.jsonl')]);
	});

	it('stop 後は通知しない', async () => {
		await watcher.stop();
		writeFileSync(join(root, 'p1', 'after-stop.jsonl'), '{}\n');
		await new Promise((r) => setTimeout(r, 500));

		expect(changes).toEqual([]);
	});
});
