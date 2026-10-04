import type { SessionLogEntry } from '../models/session-log-entry.model';

/** 1 セッション分のログファイル */
export type SessionLogFile = {
	projectId: string;
	sessionId: string;
	path: string;
	/** 差分取り込みの判定に使う */
	modifiedAt: Date;
	sizeBytes: number;
};

/** 会話の 1 発言（概要の生成と会話の表示に使う） */
export type ConversationMessage = {
	role: 'user' | 'assistant';
	text: string;
};

/** Claude Code のセッションログの読み取り。ログは読み取り専用で、書き換えない */
export interface SessionLogGateway {
	/** プロジェクト ID（ログのルート直下のディレクトリ名）の一覧 */
	listProjectIds(): Promise<string[]>;
	/** プロジェクト内のセッションログファイルの一覧 */
	listSessionFiles(projectId: string): Promise<SessionLogFile[]>;
	/** メッセージを取り出す。読めない行・対象外の行はスキップする */
	readEntries(file: SessionLogFile): Promise<SessionLogEntry[]>;
	/**
	 * 会話のテキストだけを時系列で取り出す（概要の生成と会話の表示用）。
	 * ツールの入出力・思考・メタ情報・サブエージェントの発言は含めない。
	 * 一覧を取ったあとにファイルが消えていたら null
	 */
	readConversation(file: SessionLogFile): Promise<ConversationMessage[] | null>;
}
