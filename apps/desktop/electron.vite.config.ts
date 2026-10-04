import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

export default defineConfig({
	main: {
		build: {
			rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') },
		},
	},
	preload: {
		build: {
			rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') },
		},
	},
	renderer: {
		root: resolve(__dirname, 'src/renderer'),
		resolve: {
			alias: { '@': resolve(__dirname, 'src/renderer') },
		},
		build: {
			rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
		},
		plugins: [react(), tailwindcss()],
	},
});
