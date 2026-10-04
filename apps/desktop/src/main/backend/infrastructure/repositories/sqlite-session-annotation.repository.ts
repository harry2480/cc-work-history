import type Database from 'better-sqlite3';
import {
	type AnnotatedTag,
	SessionAnnotation,
	type TagSource,
} from '../../domain/models/session-annotation.model';
import { Tag } from '../../domain/models/tag.model';
import type { SessionAnnotationRepository } from '../../domain/repositories/session-annotation.repository';

type SummaryRow = {
	id: string;
	summary: string | null;
	summary_edited_manually: number;
};

type TagRow = {
	session_id: string;
	name: string;
	source: TagSource;
};

export class SqliteSessionAnnotationRepository implements SessionAnnotationRepository {
	constructor(private readonly db: Database.Database) {}

	findBySessionId(sessionId: string): SessionAnnotation | null {
		return this.findBySessionIdsIncludingEmpty([sessionId]).get(sessionId) ?? null;
	}

	findBySessionIds(sessionIds: readonly string[]): Map<string, SessionAnnotation> {
		const all = this.findBySessionIdsIncludingEmpty(sessionIds);
		return new Map(
			[...all].filter(
				([, annotation]) => annotation.summary !== null || annotation.tags.length > 0,
			),
		);
	}

	save(sessionId: string, annotation: SessionAnnotation): void {
		this.db.transaction(() => {
			const updated = this.db
				.prepare<[string | null, number, string]>(
					'UPDATE sessions SET summary = ?, summary_edited_manually = ? WHERE id = ?',
				)
				.run(annotation.summary, annotation.summaryEditedManually ? 1 : 0, sessionId);
			if (updated.changes === 0) throw new Error(`セッションが見つかりません: ${sessionId}`);

			this.db.prepare<[string]>('DELETE FROM session_tags WHERE session_id = ?').run(sessionId);
			const insertTag = this.db.prepare<[string]>(
				'INSERT INTO tags (name) VALUES (?) ON CONFLICT (name) DO NOTHING',
			);
			const linkTag = this.db.prepare<[string, TagSource, string]>(
				'INSERT INTO session_tags (session_id, tag_id, source) SELECT ?, id, ? FROM tags WHERE name = ?',
			);
			for (const { tag, source } of annotation.tags) {
				insertTag.run(tag.name);
				linkTag.run(sessionId, source, tag.name);
			}
			// どのセッションにも付いていないタグは消す
			this.db.exec('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM session_tags)');
		})();
	}

	private findBySessionIdsIncludingEmpty(
		sessionIds: readonly string[],
	): Map<string, SessionAnnotation> {
		if (sessionIds.length === 0) return new Map();
		const ids = JSON.stringify(sessionIds);

		const summaries = this.db
			.prepare<[string], SummaryRow>(
				'SELECT id, summary, summary_edited_manually FROM sessions WHERE id IN (SELECT value FROM json_each(?))',
			)
			.all(ids);
		const tagRows = this.db
			.prepare<[string], TagRow>(
				`SELECT st.session_id, t.name, st.source
				FROM session_tags st JOIN tags t ON t.id = st.tag_id
				WHERE st.session_id IN (SELECT value FROM json_each(?))
				ORDER BY st.rowid`,
			)
			.all(ids);

		const tagsBySession = new Map<string, AnnotatedTag[]>();
		for (const row of tagRows) {
			const tag = Tag.create(row.name);
			if (!tag.success) throw new Error(`tags の行が不正です（${row.name}）: ${tag.error}`);
			const list = tagsBySession.get(row.session_id) ?? [];
			list.push({ tag: tag.value, source: row.source });
			tagsBySession.set(row.session_id, list);
		}

		return new Map(
			summaries.map((row) => [
				row.id,
				SessionAnnotation.restore({
					summary: row.summary,
					summaryEditedManually: row.summary_edited_manually === 1,
					tags: tagsBySession.get(row.id) ?? [],
				}),
			]),
		);
	}
}
