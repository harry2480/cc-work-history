import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { SessionLogFile, SessionLogGateway } from '../../domain/gateways/session-log.gateway';
import type { SessionLogEntry } from '../../domain/models/session-log-entry.model';

const SESSION_FILE_EXTENSION = '.jsonl';
/** Claude Code が API を呼ばずに生成したメッセージのモデル名 */
const SYNTHETIC_MODEL = '<synthetic>';

/**
 * `~/.claude/projects/<プロジェクト>/<sessionId>.jsonl` を読む本番実装。
 * JSONL の形式は Claude Code のバージョンで変わりうるため、必要なフィールドだけを防御的に読む。
 */
export class ClaudeCodeSessionLogAdapter implements SessionLogGateway {
	constructor(private readonly rootDir: string) {}

	async listProjectIds(): Promise<string[]> {
		const entries = await this.readDirOrEmpty(this.rootDir);
		return entries
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	}

	async listSessionFiles(projectId: string): Promise<SessionLogFile[]> {
		const projectDir = join(this.rootDir, projectId);
		const entries = await this.readDirOrEmpty(projectDir);
		const files = entries.filter((e) => e.isFile() && e.name.endsWith(SESSION_FILE_EXTENSION));

		return Promise.all(
			files.map(async (file) => {
				const path = join(projectDir, file.name);
				const stats = await stat(path);
				return {
					projectId,
					sessionId: basename(file.name, SESSION_FILE_EXTENSION),
					path,
					modifiedAt: stats.mtime,
					sizeBytes: stats.size,
				};
			}),
		);
	}

	async readEntries(file: SessionLogFile): Promise<SessionLogEntry[]> {
		const content = await readFile(file.path, 'utf-8');
		const entries: SessionLogEntry[] = [];
		// assistant の応答は内容ブロックごとに複数行に分かれ、同じ message.id と usage を持つ
		const seenAssistantMessageIds = new Set<string>();

		for (const line of content.split('\n')) {
			const entry = this.parseLine(line, seenAssistantMessageIds);
			if (entry) entries.push(entry);
		}
		return entries;
	}

	private parseLine(line: string, seenAssistantMessageIds: Set<string>): SessionLogEntry | null {
		if (!line.trim()) return null;

		let record: unknown;
		try {
			record = JSON.parse(line);
		} catch {
			return null;
		}
		if (!isObject(record)) return null;
		if (record.type !== 'user' && record.type !== 'assistant') return null;
		// Claude Code が内部的に差し込むメタ情報（ユーザーの操作ではない）
		if (record.isMeta === true) return null;

		const timestamp = typeof record.timestamp === 'string' ? new Date(record.timestamp) : null;
		if (!timestamp || Number.isNaN(timestamp.getTime())) return null;

		const message = isObject(record.message) ? record.message : {};
		const cwd = typeof record.cwd === 'string' && record.cwd ? record.cwd : undefined;

		if (record.type === 'user') {
			return { timestamp, role: 'user', inputTokens: 0, outputTokens: 0, cwd };
		}

		const messageId = typeof message.id === 'string' ? message.id : null;
		if (messageId) {
			if (seenAssistantMessageIds.has(messageId)) return null;
			seenAssistantMessageIds.add(messageId);
		}

		const usage = isObject(message.usage) ? message.usage : {};
		const model =
			typeof message.model === 'string' && message.model && message.model !== SYNTHETIC_MODEL
				? message.model
				: undefined;

		return {
			timestamp,
			role: 'assistant',
			model,
			// キャッシュの作成・読み込み分も、モデルが処理した入力として数える
			inputTokens:
				toCount(usage.input_tokens) +
				toCount(usage.cache_creation_input_tokens) +
				toCount(usage.cache_read_input_tokens),
			outputTokens: toCount(usage.output_tokens),
			cwd,
		};
	}

	private async readDirOrEmpty(dir: string) {
		try {
			return await readdir(dir, { withFileTypes: true });
		} catch (error) {
			if (isObject(error) && error.code === 'ENOENT') return [];
			throw error;
		}
	}
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
