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
};
