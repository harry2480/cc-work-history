import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	// アプリ（@vitejs/plugin-react）と同じく、React の import なしで JSX を使う
	esbuild: { jsx: 'automatic' },
	test: {
		passWithNoTests: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.{ts,tsx}'],
			exclude: [
				'src/**/*.d.ts',
				// shadcn/ui から移植した UI コンポーネント
				'src/renderer/components/ui/**',
				// Electron の起動処理（main / preload / renderer のエントリ）は E2E で確認する
				'src/main/index.ts',
				'src/preload/index.ts',
				'src/renderer/main.tsx',
			],
		},
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src/renderer'),
			'@shared': resolve(__dirname, 'src/shared'),
		},
	},
});
