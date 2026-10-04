import { describe, expectTypeOf, it } from 'vitest';
import type { Result } from '../../../../../../src/main/backend/domain/models/result.model';

describe('Result', () => {
	it('success で value と error を型で絞り込める', () => {
		const result = { success: true, value: 1 } as Result<number, string>;

		if (result.success) {
			expectTypeOf(result.value).toEqualTypeOf<number>();
		} else {
			expectTypeOf(result.error).toEqualTypeOf<string>();
		}
	});
});
