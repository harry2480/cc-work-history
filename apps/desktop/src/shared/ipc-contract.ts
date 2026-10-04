/**
 * main ↔ renderer 間の IPC チャンネルと型の唯一の定義元。
 * renderer の `window.api` の型もここから導出する。
 */

export const IPC_CHANNELS = {
	ping: 'app:ping',
} as const;

/** 疎通確認用。main が応答できることと、実行中の Electron のバージョンを返す */
export type PingResult = {
	message: string;
	electronVersion: string;
};

/** preload が `window.api` として renderer に公開する API */
export type DesktopApi = {
	ping(): Promise<PingResult>;
};
