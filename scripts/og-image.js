// Screenshots the top of the website into static/og.png, the image that link previews show. It
// builds the site, serves the build on a free port, and frames the header and headline in dark mode.
//
// The page is 880×462 CSS pixels, a little narrower than a desktop window so the headline fills
// the frame, rendered at 2400×1260: the 1.91:1 size that the og:image meta tags in
// src/routes/(site)/+page.svelte state.
import { chromium } from '@playwright/test';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createBuilder, preview } from 'vite';

const OUTPUT = 'static/og.png';
const WIDTH = 2400;
const HEIGHT = 1260;
const VIEWPORT_WIDTH = 880;

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

// like `vite build`: every environment, including the server build that prerendering renders with.
// (Vite's `build()` only builds the client, which leaves the prerendered HTML out of date)
const builder = await createBuilder({ logLevel: 'warn' });
await builder.buildApp();

// port 0 picks a free one
const server = await preview({ preview: { port: 0 }, logLevel: 'warn' });

try {
	const browser = await chromium.launch();

	try {
		const scale = WIDTH / VIEWPORT_WIDTH;
		const page = await browser.newPage({
			viewport: { width: VIEWPORT_WIDTH, height: Math.round(HEIGHT / scale) },
			deviceScaleFactor: scale,
			colorScheme: 'dark',
			// keeps the ring that follows the mouse and the demo's pretend mouse away
			reducedMotion: 'reduce'
		});

		const [url] = server.resolvedUrls?.local ?? [];
		await page.goto(url);

		// the demo shows "Reload" once the site has hydrated
		await page.getByRole('button', { name: 'Reload' }).waitFor();
		await page.evaluate(async () => {
			await document.fonts.ready;
		});

		await page.screenshot({ path: OUTPUT, animations: 'disabled' });
	} finally {
		await browser.close();
	}
} finally {
	await server.close();
}

console.log(`Wrote ${OUTPUT} (${Math.round(statSync(OUTPUT).size / 1024)} kB)`);
