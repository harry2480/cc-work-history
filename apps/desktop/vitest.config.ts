import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		passWithNoTests: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.{ts,tsx}'],
			// shadcn/ui から移植した UI コンポーネントは計測対象外
			exclude: ['src/**/*.d.ts', 'src/renderer/components/ui/**'],
		},
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src/renderer'),
		},
	},
});
