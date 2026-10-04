import type { SessionResult } from '../models/session-result.model';

export interface SessionResultRepository {
	findBySessionId(sessionId: string): SessionResult | null;
	/** 置き換える。セッションは保存済みであること */
	save(sessionId: string, result: SessionResult): void;
}
