import { describe, expect, it } from 'vitest';
import {
	type AnnotatedTag,
	SessionAnnotation,
} from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import { Tag } from '../../../../../../src/main/backend/domain/models/tag.model';

function tag(name: string, source: AnnotatedTag['source']): AnnotatedTag {
	const created = Tag.create(name);
	if (!created.success) throw new Error(created.error);
	return { tag: created.value, source };
}

const tagsOf = (annotation: SessionAnnotation) =>
	annotation.tags.map((t) => `${t.tag.name}:${t.source}`);

describe('SessionAnnotation.withGenerated', () => {
	it('概要がなければ生成した概要と自動タグを付ける（手動編集済みにはしない）', () => {
		const result = SessionAnnotation.empty().withGenerated({
			summary: '  README を直した ',
			tagNames: ['docs', 'fix'],
		});

		expect(result.summary).toBe('README を直した');
		expect(result.summaryEditedManually).toBe(false);
		expect(tagsOf(result)).toEqual(['docs:auto', 'fix:auto']);
	});

	it('手で編集した概要は上書きしない', () => {
		const annotation = SessionAnnotation.restore({
			summary: '手で書いた概要',
			summaryEditedManually: true,
			tags: [],
		});

		const result = annotation.withGenerated({ summary: '生成した概要', tagNames: [] });

		expect(result.summary).toBe('手で書いた概要');
		expect(result.summaryEditedManually).toBe(true);
	});

	it('前回の自動生成の概要は新しい概要に入れ替える。空の概要では消さない', () => {
		const annotation = SessionAnnotation.restore({
			summary: '前回の概要',
			summaryEditedManually: false,
			tags: [],
		});

		expect(annotation.withGenerated({ summary: '新しい概要', tagNames: [] }).summary).toBe(
			'新しい概要',
		);
		expect(annotation.withGenerated({ summary: '  ', tagNames: [] }).summary).toBe('前回の概要');
		expect(annotation.withGenerated({ summary: 'あ'.repeat(1001), tagNames: [] }).summary).toBe(
			'前回の概要',
		);
	});

	it('手で付けたタグは残し、前回の自動タグだけを入れ替える。重複・使えない名前は除く', () => {
		const annotation = SessionAnnotation.restore({
			summary: null,
			summaryEditedManually: false,
			tags: [tag('Electron', 'manual'), tag('old', 'auto')],
		});

		const result = annotation.withGenerated({
			summary: '概要',
			tagNames: ['electron', 'new', '', 'x'.repeat(31), 'NEW', 'a,b', 'c、d'],
		});

		expect(tagsOf(result)).toEqual(['Electron:manual', 'new:auto']);
	});

	it('タグは手動と自動を合わせて 10 個まで', () => {
		const manual = Array.from({ length: 8 }, (_, i) => tag(`m${i}`, 'manual'));
		const annotation = SessionAnnotation.restore({
			summary: null,
			summaryEditedManually: false,
			tags: manual,
		});

		const result = annotation.withGenerated({ summary: '概要', tagNames: ['a', 'b', 'c'] });

		expect(result.tags).toHaveLength(10);
		expect(tagsOf(result).slice(-2)).toEqual(['a:auto', 'b:auto']);
	});
});
