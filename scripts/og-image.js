// Screenshots the top of the website into static/og.png, the image that link previews show. It
// builds the site, serves the build on a free port, and plays the demo once in each mode first, so
// the cards under the headline compare clicks lost without the package to clicks replayed with it.
//
// The image is 1200×630 CSS pixels at twice the pixel density: 2400×1260, the size that the
// og:image meta tags in src/routes/(site)/+page.svelte state.
import { chromium } from '@playwright/test';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';

const OUTPUT = 'static/og.png';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

await build({ logLevel: 'warn' });

// port 0 picks a free one
const server = await preview({ preview: { port: 0 }, logLevel: 'warn' });

try {
	const browser = await chromium.launch();

	try {
		const page = await browser.newPage({
			viewport: { width: 1200, height: 630 },
			deviceScaleFactor: 2,
			colorScheme: 'light',
			// keeps the ring that follows the mouse and the demo's pretend mouse away. Instead, the demo
			// loads its mock page as soon as the site hydrates
			reducedMotion: 'reduce'
		});

		const [url] = server.resolvedUrls?.local ?? [];
		await page.goto(url);
		await page.getByRole('button', { name: 'Reload' }).waitFor();

		// click Add to cart twice and Like while the mock page loads, then wait for it to hydrate.
		// Like the pretend mouse's, these clicks don't move the mouse or scroll the page
		const add = page.getByRole('button', { name: 'Add to cart' });
		const like = page.getByRole('button', { name: 'Like' });

		for (const mode of [/^Without/, /^With EventReplay/]) {
			await page.getByRole('radio', { name: mode }).dispatchEvent('click');
			await add.dispatchEvent('click');
			await add.dispatchEvent('click');
			await like.dispatchEvent('click');
			await page.getByText('Hydrated').waitFor();
		}

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
