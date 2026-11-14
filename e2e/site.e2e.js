import { expect, test } from '@playwright/test';

// The demo's mock page takes 5 seconds to "hydrate"
const HYDRATED = { timeout: 10_000 };

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
	// also catches scripts being blocked by the website's Content Security Policy
	expect(errors).toEqual([]);
});

test('the demo loses clicks without the package', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Replay clicks made before hydration');

	const add = page.getByRole('button', { name: 'Add to cart' });

	// switching modes reloads the mock page
	await page.getByRole('radio', { name: /^Without/ }).check();
	await add.click();
	await add.click();
	await add.click();
	await expect(add).not.toHaveAttribute('data-replay-pending');
	await expect(page.getByText('3 lost')).toBeVisible();
	await expect(page.getByText('3 clicks on 1 button')).toBeVisible();

	await expect(page.getByText('Hydrated')).toBeVisible(HYDRATED);
	await expect(page.getByText('0 in cart')).toBeVisible();
	await expect(page.getByText('3 lost')).toBeVisible();

	// the mock page works now
	await add.click();
	await expect(page.getByText('1 in cart')).toBeVisible();
	await expect(page.getByText('3 lost')).toBeVisible();
});

test('the demo replays clicks with the package, once per button', async ({ page }) => {
	await page.goto('/');

	const add = page.getByRole('button', { name: 'Add to cart' });
	const like = page.getByRole('button', { name: 'Like' });
	const gift_wrap = page.getByRole('checkbox', { name: 'Gift wrap' });

	await page.getByRole('button', { name: 'Reload' }).click();
	await add.click();
	await add.click();
	await add.click();
	await like.click();
	await gift_wrap.check();
	await expect(add).toHaveAttribute('data-replay-pending', '');
	await expect(like).toHaveAttribute('data-replay-pending', '');
	await expect(gift_wrap).toBeChecked();
	await expect(page.getByText('0 in cart')).toBeVisible();
	await expect(page.getByText('4 clicks on 2 buttons')).toBeVisible();

	await expect(page.getByText('Hydrated')).toBeVisible(HYDRATED);
	await expect(add).not.toHaveAttribute('data-replay-pending');
	await expect(page.getByText('1 in cart')).toBeVisible();
	await expect(page.getByText('1 like')).toBeVisible();
	await expect(page.getByText('2 replayed')).toBeVisible();
	await expect(page.getByText('0 lost')).toBeVisible();
	await expect(gift_wrap).toBeChecked();
});

test('the demo works with the keyboard', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('radio', { name: /^With EventReplay/ }).focus();
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByRole('radio', { name: /^Without/ })).toBeChecked();

	await page.getByRole('button', { name: 'Add to cart' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByText('1 lost')).toBeVisible();

	await page.getByRole('button', { name: 'Reload' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByText('0 lost')).toBeVisible();
});

test('the website replays a real click made before it hydrates', async ({ page }) => {
	// hold back SvelteKit's client JavaScript, like replay.e2e.js does
	await page.route(/\/_app\/immutable\/.*\.js$/, async (route) => {
		await new Promise((fulfil) => setTimeout(fulfil, 1500));
		await route.continue();
	});

	await page.goto('/', { waitUntil: 'domcontentloaded' });

	// the inline script marks the button...
	const add = page.getByRole('button', { name: 'Add to cart' });
	await add.click();
	await expect(add).toHaveAttribute('data-replay-pending', '');

	// ...and <EventReplay> replays the click into the demo, whose mock page is still loading
	await expect(page.getByText('1 click on 1 button')).toBeVisible(HYDRATED);
	await expect(page.getByText('1 in cart')).toBeVisible(HYDRATED);
	await expect(page.getByText('1 replayed')).toBeVisible();
});
