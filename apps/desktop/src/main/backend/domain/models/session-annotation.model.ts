import type { Result } from './result.model';
import { Tag, type TagError } from './tag.model';

export const MAX_SUMMARY_LENGTH = 1000;
export const MAX_TAGS = 10;

export type TagSource = 'manual' | 'auto';

export type AnnotatedTag = {
	tag: Tag;
	source: TagSource;
};

export type SessionAnnotationError = 'SUMMARY_TOO_LONG' | 'TOO_MANY_TAGS' | TagError;

type SessionAnnotationProps = {
	summary: string | null;
	summaryEditedManually: boolean;
	tags: readonly AnnotatedTag[];
};

/** セッションの概要とタグ（ログから組み立てる Session とは別に、ユーザーの編集や自動生成で付ける情報） */
export class SessionAnnotation {
	private constructor(
		readonly summary: string | null,
		readonly summaryEditedManually: boolean,
		readonly tags: readonly AnnotatedTag[],
	) {}

	static empty(): SessionAnnotation {
		return new SessionAnnotation(null, false, []);
	}

	/** 保存済みの値から復元する */
	static restore(props: SessionAnnotationProps): SessionAnnotation {
		return new SessionAnnotation(props.summary, props.summaryEditedManually, [...props.tags]);
	}

	/**
	 * ユーザーが手動で編集した概要とタグにする。
	 * 概要は手動編集済みになり、タグはすべて手動で付けたものとして扱う。重複するタグは 1 つにまとめる
	 */
	static editManually(input: {
		summary: string | null;
		tagNames: readonly string[];
	}): Result<SessionAnnotation, SessionAnnotationError> {
		const summary = input.summary?.trim() || null;
		if (summary && summary.length > MAX_SUMMARY_LENGTH) {
			return { success: false, error: 'SUMMARY_TOO_LONG' };
		}

		const tags: Tag[] = [];
		for (const name of input.tagNames) {
			const tag = Tag.create(name);
			if (!tag.success) return tag;
			if (!tags.some((t) => t.equals(tag.value))) tags.push(tag.value);
		}
		if (tags.length > MAX_TAGS) return { success: false, error: 'TOO_MANY_TAGS' };

		return {
			success: true,
			value: new SessionAnnotation(
				summary,
				true,
				tags.map((tag) => ({ tag, source: 'manual' })),
			),
		};
	}

	get tagNames(): string[] {
		return this.tags.map((t) => t.tag.name);
	}
}
