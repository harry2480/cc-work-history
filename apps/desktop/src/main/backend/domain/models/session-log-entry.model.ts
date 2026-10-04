/**
 * セッションログ（JSONL）の 1 メッセージ分。ログ読み取り Gateway がこの形に変換して返す。
 * ドメインは JSONL の形式を知らない。
 */
export type SessionLogEntry = {
	timestamp: Date;
	role: 'user' | 'assistant';
	/** assistant の応答に使われたモデル（例: claude-opus-5-5） */
	model?: string;
	inputTokens: number;
	outputTokens: number;
	/** メッセージ送信時の作業ディレクトリ */
	cwd?: string;
	/**
	 * このメッセージで記録された作業リストの操作（記録順、未検証）。
	 * Claude Code の TodoWrite（リスト全体の書き込み）と TaskCreate / TaskUpdate（タスク単位の作成・更新）
	 */
	todoEvents?: readonly LoggedTodoEvent[];
};

/** ログに記録された TodoWrite の 1 項目。検証は TodoList が行う */
export type LoggedTodo = {
	content: string;
	status: string;
};

/** ログに記録された作業リストの操作。値の検証は TodoList が行う */
export type LoggedTodoEvent =
	/** TodoWrite: 呼び出し時点のリスト全体（空配列ならリストを空にした） */
	| { kind: 'todo-write'; todos: readonly LoggedTodo[] }
	/** TaskCreate: 割り振られた ID と件名で作成された */
	| { kind: 'task-create'; taskId: string; subject: string }
	/** TaskUpdate: 指定されたフィールドだけを更新した */
	| { kind: 'task-update'; taskId: string; subject?: string; status?: string };
