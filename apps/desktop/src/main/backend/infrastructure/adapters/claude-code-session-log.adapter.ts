import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type {
	ConversationMessage,
	SessionLogFile,
	SessionLogGateway,
} from '../../domain/gateways/session-log.gateway';
import type {
	LoggedTodo,
	LoggedTodoEvent,
	SessionLogEntry,
} from '../../domain/models/session-log-entry.model';

const SESSION_FILE_EXTENSION = '.jsonl';
/** Claude Code が API を呼ばずに生成したメッセージのモデル名 */
const SYNTHETIC_MODEL = '<synthetic>';
/** 作業リスト全体を書き込む Claude Code のツール名 */
const TODO_WRITE_TOOL = 'TodoWrite';
/** タスク単位で作業リストを操作する Claude Code のツール名。結果（tool_result）と組み合わせて読む */
const TASK_CREATE_TOOL = 'TaskCreate';
const TASK_UPDATE_TOOL = 'TaskUpdate';
const MAX_TASK_ID_LENGTH = 100;

/** 結果を待っている TaskCreate / TaskUpdate の呼び出し（tool_use の id → 入力） */
type PendingTaskCalls = Map<string, { name: string; input: Record<string, unknown> }>;

/** 1 ファイルを読む間だけ持つ状態 */
type ParseState = {
	/** assistant の応答は内容ブロックごとに複数行に分かれ、同じ message.id と usage を持つ */
	assistantEntriesById: Map<string, SessionLogEntry>;
	pendingTaskCalls: PendingTaskCalls;
};

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

		const results = await Promise.all(
			files.map(async (file): Promise<SessionLogFile | null> => {
				const path = join(projectDir, file.name);
				let stats: Awaited<ReturnType<typeof stat>>;
				try {
					stats = await stat(path);
				} catch (error) {
					// 一覧を取ってから stat するまでに消えたファイル（古いログの自動削除など）は飛ばす
					if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
					throw error;
				}
				return {
					projectId,
					sessionId: basename(file.name, SESSION_FILE_EXTENSION),
					path,
					modifiedAt: stats.mtime,
					sizeBytes: stats.size,
				};
			}),
		);
		return results.filter((file): file is SessionLogFile => file !== null);
	}

	async readEntries(file: SessionLogFile): Promise<SessionLogEntry[]> {
		const content = await readFile(file.path, 'utf-8');
		const entries: SessionLogEntry[] = [];
		const state: ParseState = { assistantEntriesById: new Map(), pendingTaskCalls: new Map() };

		for (const line of content.split('\n')) {
			const entry = this.parseLine(line, state);
			if (entry) entries.push(entry);
		}
		return entries;
	}

	async readConversation(file: SessionLogFile): Promise<ConversationMessage[]> {
		const content = await readFile(file.path, 'utf-8');
		const messages: ConversationMessage[] = [];
		// 同じ応答が内容ブロックごとに複数行に記録されるため、同じテキストは 1 回だけ使う
		const seenAssistantTexts = new Set<string>();

		for (const line of content.split('\n')) {
			if (!line.trim()) continue;
			let record: unknown;
			try {
				record = JSON.parse(line);
			} catch {
				continue;
			}
			if (!isObject(record) || !isConversationRecord(record)) continue;
			const message = isObject(record.message) ? record.message : {};
			// ツールの結果（tool_result）や思考（thinking）などのブロックは含めない
			const raw = conversationTextOf(message.content);

			if (record.type === 'user') {
				const text = stripCommandTags(raw).trim();
				if (!text || text.startsWith(INTERRUPTED_PREFIX)) continue;
				messages.push({ role: 'user', text });
			} else {
				const text = raw.trim();
				if (!text) continue;
				const key = `${typeof message.id === 'string' ? message.id : ''}\u0000${text}`;
				if (seenAssistantTexts.has(key)) continue;
				seenAssistantTexts.add(key);
				messages.push({ role: 'assistant', text });
			}
		}
		return messages;
	}

	private parseLine(line: string, state: ParseState): SessionLogEntry | null {
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

		// サブエージェントの作業リストはセッション本体の作業状況ではない
		const isSidechain = record.isSidechain === true;

		if (record.type === 'user') {
			const entry: SessionLogEntry = {
				timestamp,
				role: 'user',
				inputTokens: 0,
				outputTokens: 0,
				cwd,
			};
			const events = isSidechain
				? []
				: taskEventsFromResults(message.content, record.toolUseResult, state.pendingTaskCalls);
			if (events.length > 0) entry.todoEvents = events;
			return entry;
		}

		const events = isSidechain ? [] : todoEventsFromCalls(message.content, state.pendingTaskCalls);
		const messageId = typeof message.id === 'string' ? message.id : null;
		const seen = messageId ? state.assistantEntriesById.get(messageId) : undefined;
		if (seen) {
			// 重複行は数えないが、ツール呼び出しは別の行に記録されるため作業リストの操作は拾う
			if (events.length > 0) seen.todoEvents = [...(seen.todoEvents ?? []), ...events];
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
		if (events.length > 0) entry.todoEvents = events;
		if (messageId) state.assistantEntriesById.set(messageId, entry);
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
 * assistant メッセージの内容ブロックから作業リストの操作を取り出す。
 * TodoWrite はその場でリスト全体の書き込みとして扱う。
 * TaskCreate / TaskUpdate は割り振られた ID や成否が結果に記録されるため、結果を待つ呼び出しとして覚えておく
 */
function todoEventsFromCalls(content: unknown, pending: PendingTaskCalls): LoggedTodoEvent[] {
	if (!Array.isArray(content)) return [];
	const events: LoggedTodoEvent[] = [];
	for (const block of content) {
		if (!isObject(block) || block.type !== 'tool_use' || !isObject(block.input)) continue;
		if (block.name === TODO_WRITE_TOOL) {
			const todos = parseTodos(block.input.todos);
			if (todos) events.push({ kind: 'todo-write', todos });
		} else if (
			(block.name === TASK_CREATE_TOOL || block.name === TASK_UPDATE_TOOL) &&
			typeof block.id === 'string'
		) {
			pending.set(block.id, { name: block.name, input: block.input });
		}
	}
	return events;
}

/** TodoWrite の todos。配列でなければ undefined、文字列の content / status を持たない項目は捨てる */
function parseTodos(value: unknown): LoggedTodo[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value.flatMap((todo: unknown) =>
		isObject(todo) && typeof todo.content === 'string' && typeof todo.status === 'string'
			? [{ content: todo.content, status: todo.status }]
			: [],
	);
}

/**
 * user 行の tool_result から、対応する TaskCreate / TaskUpdate の操作を組み立てる。
 * 失敗した呼び出し・ID が分からない呼び出し・壊れた入力は無視する。
 * 行ごとの toolUseResult は、tool_result が 1 つだけの行でのみ信頼する
 */
function taskEventsFromResults(
	content: unknown,
	toolUseResult: unknown,
	pending: PendingTaskCalls,
): LoggedTodoEvent[] {
	if (!Array.isArray(content)) return [];
	const results = content.filter(
		(block): block is Record<string, unknown> =>
			isObject(block) && block.type === 'tool_result' && typeof block.tool_use_id === 'string',
	);
	const detail = results.length === 1 && isObject(toolUseResult) ? toolUseResult : {};

	const events: LoggedTodoEvent[] = [];
	for (const result of results) {
		const call = pending.get(result.tool_use_id as string);
		if (!call) continue;
		pending.delete(result.tool_use_id as string);
		if (result.is_error === true || detail.success === false) continue;

		const event =
			call.name === TASK_CREATE_TOOL
				? taskCreateEvent(call.input, result, detail)
				: taskUpdateEvent(call.input);
		if (event) events.push(event);
	}
	return events;
}

function taskCreateEvent(
	input: Record<string, unknown>,
	result: Record<string, unknown>,
	detail: Record<string, unknown>,
): LoggedTodoEvent | null {
	const task = isObject(detail.task) ? detail.task : {};
	// 結果の本文（"Task #<ID> created ..."）は toolUseResult がない場合の代わり
	const taskId =
		toTaskId(task.id) ?? toTaskId(/Task #(\S+) created/.exec(textOf(result.content))?.[1]);
	const subject =
		typeof input.subject === 'string'
			? input.subject
			: typeof task.subject === 'string'
				? task.subject
				: null;
	if (!taskId || subject === null) return null;
	return { kind: 'task-create', taskId, subject };
}

function taskUpdateEvent(input: Record<string, unknown>): LoggedTodoEvent | null {
	const taskId = toTaskId(input.taskId);
	if (!taskId) return null;
	const event: LoggedTodoEvent = { kind: 'task-update', taskId };
	if (typeof input.subject === 'string') event.subject = input.subject;
	if (typeof input.status === 'string') event.status = input.status;
	return event;
}

function toTaskId(value: unknown): string | null {
	const id = typeof value === 'number' && Number.isFinite(value) ? String(value) : value;
	return typeof id === 'string' && id.trim() && id.length <= MAX_TASK_ID_LENGTH ? id.trim() : null;
}

function textOf(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.map((block) => (isObject(block) && typeof block.text === 'string' ? block.text : ''))
		.join('\n');
}

/** ユーザーが中断したときに Claude Code が差し込む発言 */
const INTERRUPTED_PREFIX = '[Request interrupted by user';

/** Claude Code が差し込むタグのうち、中身ごと除くもの（コマンド名・コマンドやシェルの出力など） */
const DROPPED_TAGS = [
	'command-name',
	'command-message',
	'local-command-stdout',
	'local-command-stderr',
	'local-command-caveat',
	'bash-stdout',
	'bash-stderr',
	'system-reminder',
	'task-notification',
];
/** タグだけを除き、中身（ユーザーが入力したもの）は残すタグ */
const UNWRAPPED_TAGS = ['command-args', 'bash-input'];

/** 会話として要約に使う行か。メタ情報・サブエージェント・compact の要約・API エラーなどは除く */
function isConversationRecord(record: Record<string, unknown>): boolean {
	if (record.type !== 'user' && record.type !== 'assistant') return false;
	if (record.isMeta === true || record.isSidechain === true) return false;
	// compact 後に差し込まれる、それまでの会話の要約（ユーザーの発言ではない）
	if (record.isCompactSummary === true || record.isVisibleInTranscriptOnly === true) return false;
	if (record.type === 'user') {
		// 作業完了の通知など、人が入力したのではない発言
		const origin = isObject(record.origin) ? record.origin : null;
		return !origin || origin.kind === undefined || origin.kind === 'human';
	}
	const message = isObject(record.message) ? record.message : {};
	return record.isApiErrorMessage !== true && message.model !== SYNTHETIC_MODEL;
}

function stripCommandTags(text: string): string {
	let result = text;
	for (const tag of DROPPED_TAGS) {
		result = result.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g'), '');
	}
	for (const tag of UNWRAPPED_TAGS) {
		result = result.replace(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'), '$1');
	}
	return result;
}

/** 発言のテキスト。文字列か、text ブロックだけをつなげたもの */
function conversationTextOf(content: unknown): string {
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';
	return content
		.filter((block) => isObject(block) && block.type === 'text' && typeof block.text === 'string')
		.map((block) => (block as { text: string }).text)
		.join('\n');
}

function toCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}
