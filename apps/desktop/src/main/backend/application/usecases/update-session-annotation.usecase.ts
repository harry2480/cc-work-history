import { SessionAnnotation } from '../../domain/models/session-annotation.model';
import type { SessionAnnotationRepository } from '../../domain/repositories/session-annotation.repository';

export type UpdateSessionAnnotationInput = {
	sessionId: string;
	summary: string | null;
	tagNames: readonly string[];
};

/** 入力が不正なとき（ドメインの不変条件に反するとき）のエラー */
export class InvalidAnnotationError extends Error {
	override name = 'InvalidAnnotationError';
}

/** ユーザーが編集した概要とタグを保存する。概要は手動編集済みになる */
export class UpdateSessionAnnotationUseCase {
	constructor(private readonly sessionAnnotationRepository: SessionAnnotationRepository) {}

	execute(input: UpdateSessionAnnotationInput): void {
		if (!this.sessionAnnotationRepository.findBySessionId(input.sessionId)) {
			throw new InvalidAnnotationError(`セッションが見つかりません: ${input.sessionId}`);
		}
		const annotation = SessionAnnotation.editManually({
			summary: input.summary,
			tagNames: input.tagNames,
		});
		if (!annotation.success) throw new InvalidAnnotationError(MESSAGES[annotation.error]);
		this.sessionAnnotationRepository.save(input.sessionId, annotation.value);
	}
}

const MESSAGES = {
	SUMMARY_TOO_LONG: '概要が長すぎます（1000 文字まで）',
	TOO_MANY_TAGS: 'タグが多すぎます（10 個まで）',
	EMPTY_NAME: '空のタグは付けられません',
	NAME_TOO_LONG: 'タグが長すぎます（30 文字まで）',
} as const;
