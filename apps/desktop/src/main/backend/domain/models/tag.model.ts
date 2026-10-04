import type { Result } from './result.model';

export type TagError = 'EMPTY_NAME' | 'NAME_TOO_LONG';

export const MAX_TAG_NAME_LENGTH = 30;

/** セッションに付けるタグ。名前は前後の空白を除き、連続する空白を 1 つにまとめる */
export class Tag {
	private constructor(readonly name: string) {}

	static create(name: string): Result<Tag, TagError> {
		const normalized = name.trim().replace(/\s+/g, ' ');
		if (!normalized) return { success: false, error: 'EMPTY_NAME' };
		if (normalized.length > MAX_TAG_NAME_LENGTH) return { success: false, error: 'NAME_TOO_LONG' };
		return { success: true, value: new Tag(normalized) };
	}

	/** 大文字小文字を区別せずに同じタグか */
	equals(other: Tag): boolean {
		return this.name.toLowerCase() === other.name.toLowerCase();
	}
}
