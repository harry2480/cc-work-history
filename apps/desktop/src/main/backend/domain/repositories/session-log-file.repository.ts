import type { SessionLogFile } from '../gateways/session-log.gateway';

/** 取り込み済みのファイル。活動区間を計算したときの閾値も記録する */
export type ImportedSessionLogFile = SessionLogFile & {
	idleThresholdMs: number;
};

/** 取り込み済みのセッションログファイルの記録（差分取り込みの判定に使う） */
export interface SessionLogFileRepository {
	/** パスをキーにした取り込み済みファイルの一覧 */
	findAll(): Map<string, ImportedSessionLogFile>;
	save(file: ImportedSessionLogFile): void;
}
