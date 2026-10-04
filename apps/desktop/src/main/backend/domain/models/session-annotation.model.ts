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

	/**
	 * 自動生成した概要とタグを反映する。
	 * - 手動で編集した概要は上書きしない。概要が空・長すぎる場合も今の概要を残す
	 * - 手動で付けたタグは残し、前回の自動タグを今回の自動タグに入れ替える。
	 *   使えないタグ名や手動タグとの重複は除き、合計 MAX_TAGS 個までにする
	 */
	withGenerated(generated: { summary: string; tagNames: readonly string[] }): SessionAnnotation {
		const generatedSummary = generated.summary.trim();
		const summary =
			this.summaryEditedManually ||
			!generatedSummary ||
			generatedSummary.length > MAX_SUMMARY_LENGTH
				? this.summary
				: generatedSummary;

		const tags: AnnotatedTag[] = this.tags.filter((t) => t.source === 'manual');
		for (const name of generated.tagNames) {
			if (tags.length >= MAX_TAGS) break;
			// 手動編集の入力欄の区切り文字を含むタグは、再編集で分かれてしまうので使わない
			if (/[,、\n]/.test(name)) continue;
			const tag = Tag.create(name);
			if (!tag.success || tags.some((t) => t.tag.equals(tag.value))) continue;
			tags.push({ tag: tag.value, source: 'auto' });
		}
		return new SessionAnnotation(summary, this.summaryEditedManually, tags);
	}

	get tagNames(): string[] {
		return this.tags.map((t) => t.tag.name);
	}
}
