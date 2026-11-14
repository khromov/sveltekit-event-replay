import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run generate && vite build && vite preview --port 4319 --strictPort',
		port: 4319
	},
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	expect: { timeout: 3000 },
	use: { baseURL: 'http://localhost:4319' },
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
		{ name: 'firefox', use: { browserName: 'firefox' } },
		{ name: 'webkit', use: { browserName: 'webkit' } }
	]
});
