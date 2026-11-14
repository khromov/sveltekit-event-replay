import { expect, test } from '@playwright/test';

const JS_DELAY = 1500;

/**
 * Loads a page with every SvelteKit client chunk held back, so the server-rendered HTML sits
 * un-hydrated for a while — like a slow network.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} url
 */
async function goto_slow(page, url) {
	await page.route(/\/_app\/immutable\/.*\.js$/, async (route) => {
		await new Promise((fulfil) => setTimeout(fulfil, JS_DELAY));
		await route.continue();
	});

	await page.goto(url, { waitUntil: 'domcontentloaded' });
	expect(await is_hydrated(page)).toBe(false);
}

/** @param {import('@playwright/test').Page} page */
function is_hydrated(page) {
	return page.evaluate(() => 'hydrated' in document.documentElement.dataset);
}

/**
 * Waits until the app has hydrated and `<EventReplay>` has replayed what it captured.
 *
 * @param {import('@playwright/test').Page} page
 */
async function replayed(page) {
	await expect(page.locator('#replayed')).toContainText('Replayed', { timeout: JS_DELAY + 10_000 });
}

/** @type {string[]} */
let errors = [];

test.beforeEach(({ page }) => {
	errors = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(error.message));
});

test.afterEach(() => {
	// also catches the inline script being blocked by the demo app's Content Security Policy
	expect(errors).toEqual([]);
});

test('replays a click on a delegated onclick handler', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#delegated');
	await replayed(page);
	await expect(page.locator('#delegated-count')).toHaveText('1');
	await expect(page.locator('#replayed')).toHaveText('Replayed 1 event after hydration: click');
});

test('replays repeated clicks on the same element once', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#delegated');
	await page.click('#delegated');
	await page.click('#delegated');
	await replayed(page);
	await expect(page.locator('#delegated-count')).toHaveText('1');
});

test('replays every click with dedupe=false', async ({ page }) => {
	await goto_slow(page, '/?dedupe=false');
	await page.click('#delegated');
	await page.click('#delegated');
	await page.click('#delegated');
	await replayed(page);
	await expect(page.locator('#delegated-count')).toHaveText('3');
});

test('replays clicks on different elements in order', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#delegated');
	await page.click('#listener');
	await replayed(page);
	await expect(page.locator('#delegated-count')).toHaveText('1');
	await expect(page.locator('#listener-count')).toHaveText('1');
});

test('a click on a child element reaches the handler on its button', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#nested-icon');
	await page.click('#nested'); // same button, so deduped
	await replayed(page);
	await expect(page.locator('#nested-count')).toHaveText('1');
});

test('replays to listeners added with addEventListener in onMount', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#listener');
	await replayed(page);
	await expect(page.locator('#listener-count')).toHaveText('1');
});

test('marks elements as pending until the replay', async ({ page }) => {
	await goto_slow(page, '/');
	await expect(page.locator('#delegated')).not.toHaveAttribute('data-replay-pending');
	await page.click('#delegated');
	await expect(page.locator('#delegated')).toHaveAttribute('data-replay-pending', '');
	await replayed(page);
	await expect(page.locator('#delegated')).not.toHaveAttribute('data-replay-pending');
});

test('does not capture elements marked data-no-replay', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#ignored');
	await expect(page.locator('#ignored')).not.toHaveAttribute('data-replay-pending');
	await replayed(page);
	await expect(page.locator('#ignored-count')).toHaveText('0');
	await expect(page.locator('#replayed')).toHaveText('Replayed 0 events after hydration');
});

test('leaves native checkboxes alone, so they toggle exactly once', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#check');
	await replayed(page);
	await expect(page.locator('#check')).toBeChecked();
	await expect(page.locator('#check-state')).toHaveText('true');
});

test('leaves links alone, so the browser follows them natively', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#other');
	await expect(page).toHaveURL('/other');
	await expect(page.locator('h1')).toHaveText('Another page');

	// Leaving the page mid-load aborts SvelteKit's own (delayed) boot import(), which Firefox and
	// WebKit report as an error. That's the test's artificial delay, not this library
	errors = errors.filter(
		(error) => !/module script failed|dynamically imported module/.test(error)
	);
});

test('does not capture input events by default', async ({ page }) => {
	await goto_slow(page, '/');
	await page.fill('#text', 'hello');
	await replayed(page);
	await expect(page.locator('#text')).toHaveValue('hello');
	await expect(page.locator('#text-value')).toHaveText('');
});

test('replays input events with events=click,input', async ({ page }) => {
	await goto_slow(page, '/?events=click,input');
	await page.click('#delegated');
	await page.locator('#text').pressSequentially('hello');
	await replayed(page);
	await expect(page.locator('#text-value')).toHaveText('hello');
	await expect(page.locator('#delegated-count')).toHaveText('1');
});

test('handles clicks after hydration normally, without double counting', async ({ page }) => {
	await goto_slow(page, '/');
	await page.click('#delegated');
	await replayed(page);
	await page.click('#delegated');
	await page.click('#listener');
	await expect(page.locator('#delegated-count')).toHaveText('2');
	await expect(page.locator('#listener-count')).toHaveText('1');
});

test('does nothing on client-side navigations', async ({ page }) => {
	await goto_slow(page, '/');
	await replayed(page);
	await page.click('#other');
	await expect(page.locator('h1')).toHaveText('Another page');
	await page.click('#home');
	await page.click('#delegated');
	await expect(page.locator('#delegated-count')).toHaveText('1');
	expect(await page.evaluate(() => '__sveltekit_event_replay' in window)).toBe(false);
});

test('without JavaScript, drops captured events after the timeout', async ({ page }) => {
	await page.goto('/no-js?timeout=500');
	await page.click('#button');
	await expect(page.locator('#button')).toHaveAttribute('data-replay-pending', '');
	await expect(page.locator('#button')).not.toHaveAttribute('data-replay-pending', {
		timeout: 2000
	});
});
