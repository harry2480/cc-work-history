import type { UpdateSessionAnnotationUseCase } from '../../application/usecases/update-session-annotation.usecase';
import { InvalidIpcRequestError } from '../loaders/timeline.loader';

const MAX_ID_LENGTH = 200;
/** ドメインの上限（1000 文字・10 個・各 30 文字）より緩い、明らかに不正な入力を弾くための上限 */
const MAX_SUMMARY_INPUT_LENGTH = 5000;
const MAX_TAGS_INPUT = 50;
const MAX_TAG_INPUT_LENGTH = 200;

/** セッションの概要とタグを手動で編集する */
export function updateSessionAnnotation(
	useCase: UpdateSessionAnnotationUseCase,
	request: unknown,
): void {
	if (typeof request !== 'object' || request === null || Array.isArray(request)) {
		throw new InvalidIpcRequestError('リクエストが不正です');
	}
	const { id, summary, tags } = request as Record<string, unknown>;

	if (typeof id !== 'string' || !id.trim() || id.length > MAX_ID_LENGTH) {
		throw new InvalidIpcRequestError('セッション ID が不正です');
	}
	if (
		summary !== null &&
		(typeof summary !== 'string' || summary.length > MAX_SUMMARY_INPUT_LENGTH)
	) {
		throw new InvalidIpcRequestError('概要が不正です');
	}
	if (
		!Array.isArray(tags) ||
		tags.length > MAX_TAGS_INPUT ||
		tags.some((tag) => typeof tag !== 'string' || tag.length > MAX_TAG_INPUT_LENGTH)
	) {
		throw new InvalidIpcRequestError('タグが不正です');
	}

	useCase.execute({ sessionId: id, summary, tagNames: tags as string[] });
}
