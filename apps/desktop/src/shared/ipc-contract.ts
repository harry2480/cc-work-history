/**
 * main ↔ renderer 間の IPC チャンネルと型の唯一の定義元。
 * renderer の `window.api` の型もここから導出する。
 */

export const IPC_CHANNELS = {
	ping: 'app:ping',
	/** main → renderer: 取り込みでセッションが追加・更新された */
	sessionsChanged: 'sessions:changed',
} as const;

/** 疎通確認用。main が応答できることと、実行中の Electron のバージョンを返す */
export type PingResult = {
	message: string;
	electronVersion: string;
};

/** セッションの追加・更新の通知。日時は ISO 8601 文字列 */
export type SessionsChangedPayload = {
	sessionIds: string[];
	/** 変わったセッションが含まれる期間 */
	from: string;
	to: string;
};

/** preload が `window.api` として renderer に公開する API */
export type DesktopApi = {
	ping(): Promise<PingResult>;
	/** セッションの変更を購読する。戻り値の関数で購読を解除する */
	onSessionsChanged(listener: (payload: SessionsChangedPayload) => void): () => void;
};
