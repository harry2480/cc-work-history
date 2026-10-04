import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { SessionLogFile, SessionLogGateway } from '../../domain/gateways/session-log.gateway';
import type { LoggedTodo, SessionLogEntry } from '../../domain/models/session-log-entry.model';

const SESSION_FILE_EXTENSION = '.jsonl';
/** Claude Code が API を呼ばずに生成したメッセージのモデル名 */
const SYNTHETIC_MODEL = '<synthetic>';
/** 作業リストを書き込む Claude Code のツール名 */
const TODO_WRITE_TOOL = 'TodoWrite';

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
		const assistantEntriesById = new Map<string, SessionLogEntry>();

		for (const line of content.split('\n')) {
			const entry = this.parseLine(line, assistantEntriesById);
			if (entry) entries.push(entry);
		}
		return entries;
	}

	private parseLine(
		line: string,
		assistantEntriesById: Map<string, SessionLogEntry>,
	): SessionLogEntry | null {
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

		// サブエージェントの作業リストはセッション本体の作業状況ではない
		const todos = record.isSidechain === true ? undefined : extractTodos(message.content);
		const messageId = typeof message.id === 'string' ? message.id : null;
		const seen = messageId ? assistantEntriesById.get(messageId) : undefined;
		if (seen) {
			// 重複行は数えないが、ツール呼び出しは別の行に記録されるため作業リストは拾う
			if (todos) seen.todos = todos;
			return null;
		}

		const usage = isObject(message.usage) ? message.usage : {};
		const model =
			typeof message.model === 'string' && message.model && message.model !== SYNTHETIC_MODEL
				? message.model
				: undefined;

		const entry: SessionLogEntry = {
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
		if (todos) entry.todos = todos;
		if (messageId) assistantEntriesById.set(messageId, entry);
		return entry;
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

/**
 * assistant メッセージの内容ブロックから、最後の TodoWrite ツール呼び出しの作業リストを取り出す。
 * 呼び出しがなければ undefined。文字列でない項目は捨てる（内容の検証はドメインで行う）
 */
function extractTodos(content: unknown): LoggedTodo[] | undefined {
	if (!Array.isArray(content)) return undefined;
	let todos: LoggedTodo[] | undefined;
	for (const block of content) {
		if (!isObject(block) || block.type !== 'tool_use' || block.name !== TODO_WRITE_TOOL) continue;
		const input = isObject(block.input) ? block.input : {};
		if (!Array.isArray(input.todos)) continue;
		todos = input.todos.flatMap((todo: unknown) =>
			isObject(todo) && typeof todo.content === 'string' && typeof todo.status === 'string'
				? [{ content: todo.content, status: todo.status }]
				: [],
		);
	}
	return todos;
}

function toCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
