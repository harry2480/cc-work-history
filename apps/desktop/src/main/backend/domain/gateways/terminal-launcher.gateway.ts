/** ターミナルで Claude Code のセッションを再開するための情報 */
export type ResumeTarget = {
	/** `claude -r` を実行するディレクトリ（セッションを始めた作業ディレクトリ） */
	cwd: string;
	sessionId: string;
};

export type TerminalLaunchResult =
	| { status: 'ok' }
	/** この OS ではターミナルを開けない（初回は macOS のみ対応） */
	| { status: 'unsupported'; reason: string }
	/** 作業ディレクトリがない・ターミナルの起動に失敗したなど */
	| { status: 'failed'; reason: string };

/** ターミナルを開き、`claude -r <セッション ID>` でセッションを再開する */
export interface TerminalLauncherGateway {
	resume(target: ResumeTarget): Promise<TerminalLaunchResult>;
}
