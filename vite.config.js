import process from 'node:process';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SCRIPT_HASH } from './src/lib/generated/script.js';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			paths: {
				// GitHub Pages serves the website from /sveltekit-event-replay, which the deploy workflow
				// passes in as BASE_PATH
				base: process.argv.includes('dev')
					? ''
					: /** @type {`/${string}` | undefined} */ (process.env.BASE_PATH)
			},
			// The website runs with a strict CSP to prove that SCRIPT_HASH is all you need
			csp: {
				directives: { 'script-src': ['self', SCRIPT_HASH] }
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
