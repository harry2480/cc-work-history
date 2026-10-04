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
	 * このメッセージで Claude Code の TodoWrite ツールが書き込んだ作業リスト（呼び出し時点の全項目、未検証）。
	 * TodoWrite を呼んでいなければ undefined、空のリストを書き込んだなら空配列
	 */
	todos?: readonly LoggedTodo[];
};

/** ログに記録された TodoWrite の 1 項目。検証は TodoList が行う */
export type LoggedTodo = {
	content: string;
	status: string;
};
