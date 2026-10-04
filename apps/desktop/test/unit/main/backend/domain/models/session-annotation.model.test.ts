import { describe, expect, it } from 'vitest';
import { SessionAnnotation } from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import { Tag } from '../../../../../../src/main/backend/domain/models/tag.model';

describe('Tag', () => {
	it('前後の空白を除き、連続する空白を 1 つにまとめる', () => {
		const tag = Tag.create('  バグ   修正 ');
		expect(tag.success && tag.value.name).toBe('バグ 修正');
	});

	it('空・長すぎる名前はエラーにする', () => {
		expect(Tag.create('   ')).toEqual({ success: false, error: 'EMPTY_NAME' });
		expect(Tag.create('x'.repeat(31))).toEqual({ success: false, error: 'NAME_TOO_LONG' });
	});

	it('大文字小文字を区別せずに比較する', () => {
		const a = Tag.create('README');
		const b = Tag.create('readme');
		expect(a.success && b.success && a.value.equals(b.value)).toBe(true);
	});
});

describe('SessionAnnotation.editManually', () => {
	it('概要を手動編集済みにし、タグを手動で付けたものとして重複を除く', () => {
		const result = SessionAnnotation.editManually({
			summary: '  README を直した  ',
			tagNames: ['README', 'docs', 'readme', ' docs '],
		});

		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.value.summary).toBe('README を直した');
		expect(result.value.summaryEditedManually).toBe(true);
		expect(result.value.tagNames).toEqual(['README', 'docs']);
		expect(result.value.tags.every((t) => t.source === 'manual')).toBe(true);
	});

	it('空の概要は null にする', () => {
		const result = SessionAnnotation.editManually({ summary: '  ', tagNames: [] });
		expect(result.success && result.value.summary).toBeNull();
	});

	it('長すぎる概要・多すぎるタグ・空のタグはエラーにする', () => {
		expect(SessionAnnotation.editManually({ summary: 'x'.repeat(1001), tagNames: [] })).toEqual({
			success: false,
			error: 'SUMMARY_TOO_LONG',
		});
		expect(
			SessionAnnotation.editManually({
				summary: null,
				tagNames: Array.from({ length: 11 }, (_, i) => `t${i}`),
			}),
		).toEqual({ success: false, error: 'TOO_MANY_TAGS' });
		expect(SessionAnnotation.editManually({ summary: null, tagNames: ['ok', ' '] })).toEqual({
			success: false,
			error: 'EMPTY_NAME',
		});
	});
});
