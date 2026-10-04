import { describe, expect, it } from 'vitest';
import {
	InvalidAnnotationError,
	UpdateSessionAnnotationUseCase,
} from '../../../../../../src/main/backend/application/usecases/update-session-annotation.usecase';
import { SessionAnnotation } from '../../../../../../src/main/backend/domain/models/session-annotation.model';
import type { SessionAnnotationRepository } from '../../../../../../src/main/backend/domain/repositories/session-annotation.repository';

class InMemoryAnnotationRepository implements SessionAnnotationRepository {
	readonly saved = new Map<string, SessionAnnotation>();
	constructor(private readonly sessionIds: string[]) {}
	findBySessionId(id: string) {
		return this.sessionIds.includes(id) ? (this.saved.get(id) ?? SessionAnnotation.empty()) : null;
	}
	findBySessionIds() {
		return new Map(this.saved);
	}
	save(id: string, annotation: SessionAnnotation) {
		this.saved.set(id, annotation);
	}
	findAllTagNames() {
		return [];
	}
}

describe('UpdateSessionAnnotationUseCase', () => {
	it('概要とタグを手動編集として保存する', () => {
		const repo = new InMemoryAnnotationRepository(['s1']);
		new UpdateSessionAnnotationUseCase(repo).execute({
			sessionId: 's1',
			summary: '要約',
			tagNames: ['a'],
		});

		expect(repo.saved.get('s1')?.summaryEditedManually).toBe(true);
		expect(repo.saved.get('s1')?.tagNames).toEqual(['a']);
	});

	it('存在しないセッション・不正な入力はエラーにして保存しない', () => {
		const repo = new InMemoryAnnotationRepository(['s1']);
		const useCase = new UpdateSessionAnnotationUseCase(repo);

		expect(() => useCase.execute({ sessionId: 'missing', summary: null, tagNames: [] })).toThrow(
			InvalidAnnotationError,
		);
		expect(() => useCase.execute({ sessionId: 's1', summary: null, tagNames: [' '] })).toThrow(
			'空のタグは付けられません',
		);
		expect(repo.saved.size).toBe(0);
	});
});
