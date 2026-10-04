import type { SessionAnnotation } from '../models/session-annotation.model';

export interface SessionAnnotationRepository {
	/** セッションの概要とタグ。セッションがなければ null、概要・タグがなければ空の注釈 */
	findBySessionId(sessionId: string): SessionAnnotation | null;
	/** 複数セッションの概要とタグ（タイムライン用）。概要・タグがないセッションは含まない */
	findBySessionIds(sessionIds: readonly string[]): Map<string, SessionAnnotation>;
	/** 概要とタグを置き換える。セッションは保存済みであること */
	save(sessionId: string, annotation: SessionAnnotation): void;
}
