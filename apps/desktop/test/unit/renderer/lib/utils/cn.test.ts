import { cn } from '@/lib/utils/cn';
import { describe, expect, it } from 'vitest';

describe('cn', () => {
	it('条件付きのクラスを結合する', () => {
		expect(cn('px-2', false && 'hidden', 'text-sm')).toBe('px-2 text-sm');
	});

	it('競合する Tailwind クラスは後勝ちでまとめる', () => {
		expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
	});

	it('拡張した角丸トークン（rounded-button など）も競合として扱う', () => {
		expect(cn('rounded-md', 'rounded-button')).toBe('rounded-button');
	});
});
