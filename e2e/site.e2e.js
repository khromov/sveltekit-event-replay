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
	await page.getByRole('radio', { name: /^Standard SvelteKit/ }).check();
	await add.click();
	await add.click();
	await add.click();
	await expect(add).not.toHaveAttribute('data-replay-pending');
	await expect(page.getByText('3 lost')).toBeVisible();
	await expect(page.getByText('3 clicks on 1 button')).toBeVisible();

	await expect(page.locator('.lost')).toBeHidden();
	await expect(page.getByText('Hydrated')).toBeVisible(HYDRATED);
	await expect(page.getByText('0 in cart')).toBeVisible();
	await expect(page.getByText('3 lost')).toBeVisible();
	await expect(page.locator('.lost')).toHaveText('Events lost');

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

	// reaching for the demo loads its mock page, which starts out blank
	await page.locator('.demo').hover();
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
	await expect(page.locator('.lost')).toBeHidden();
	await expect(gift_wrap).toBeChecked();
});

test('the demo works with the keyboard', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('radio', { name: /^With EventReplay/ }).focus();
	await page.keyboard.press('ArrowLeft');
	await expect(page.getByRole('radio', { name: /^Standard SvelteKit/ })).toBeChecked();

	await page.getByRole('button', { name: 'Add to cart' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByText('1 lost')).toBeVisible();

	await page.getByRole('button', { name: 'Reload' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByText('0 lost')).toBeVisible();
});

test('the website replays a real click made before it hydrates', async ({ page }) => {
	// a short window keeps the demo out of view, so the pretend mouse doesn't load it instead
	await page.setViewportSize({ width: 1280, height: 400 });

	// hold back SvelteKit's client JavaScript, like replay.e2e.js does
	await page.route(/\/_app\/immutable\/.*\.js$/, async (route) => {
		await new Promise((fulfil) => setTimeout(fulfil, 1500));
		await route.continue();
	});

	await page.goto('/', { waitUntil: 'domcontentloaded' });

	// the demo's mock page starts out blank, and the inline script marks the Load button...
	const load = page.getByRole('button', { name: 'Load' });
	await load.click();
	await expect(load).toHaveAttribute('data-replay-pending', '');

	// (step away, so the demo doesn't load itself for a visitor resting on it)
	await page.mouse.move(0, 0);
	await page.evaluate(() => scrollTo(0, 0));

	// ...and <EventReplay> replays the click once the site has hydrated, which loads the mock page
	await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible(HYDRATED);
	await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
	await expect(page.locator('[data-replay-pending]')).toHaveCount(0);
});

test('the demo starts blank and loads when the visitor reaches for it', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 400 });
	await page.goto('/');

	await expect(page.getByRole('button', { name: 'Load' })).toBeVisible();
	await expect(page.locator('[data-tour="status"]')).toHaveText('Idle');
	await expect(page.getByRole('button', { name: 'Add to cart' })).toBeHidden();

	await page.locator('.demo').hover();
	await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
	await expect(page.locator('[data-tour="status"]')).toHaveText('Loading JavaScript…');
});

test('a ring follows the mouse over the header', async ({ page }) => {
	await page.goto('/');
	const ring = page.locator('.ring');
	const opacity = () => ring.evaluate((element) => Number(getComputedStyle(element).opacity));

	// keep moving, like a visitor would, until the page has hydrated and the ring picks it up
	await expect(async () => {
		await page.mouse.move(400, 150);
		await page.mouse.move(410, 160);
		expect(await opacity()).toBeGreaterThan(0);
	}).toPass();

	// it settles centred on the pointer
	await expect
		.poll(async () => {
			const box = /** @type {{ x: number, y: number, width: number, height: number }} */ (
				await ring.boundingBox()
			);
			return Math.hypot(box.x + box.width / 2 - 410, box.y + box.height / 2 - 160);
		})
		.toBeLessThan(2);

	// below the header
	await page.mouse.move(400, 700);
	await expect.poll(opacity).toBe(0);
});

test('a pretend mouse plays the demo until the visitor moves over it', async ({ page }) => {
	// a short window, so the demo starts out of view
	await page.setViewportSize({ width: 1280, height: 400 });
	await page.goto('/');
	await expect(page.getByRole('button', { name: 'Load' })).toBeVisible();
	const mouse = page.locator('.demo .mouse');
	await expect(mouse).not.toHaveClass(/touring/);

	// it starts once the demo scrolls into view...
	await page.locator('.demo').evaluate((demo) => demo.scrollIntoView({ block: 'start' }));
	await expect(mouse).toHaveClass(/touring/);

	// ...clicks Load, Add to cart twice and Like while the mock page loads, and they're replayed
	await expect(page.getByText('3 clicks on 2 buttons')).toBeVisible(HYDRATED);
	await expect(page.getByText('2 replayed')).toBeVisible(HYDRATED);

	// reaching for the demo puts the pretend mouse away for good
	const box = /** @type {{ x: number, y: number }} */ (await page.locator('.demo').boundingBox());
	await page.mouse.move(box.x + 20, box.y + 20);
	await expect(mouse).not.toHaveClass(/touring/);
});

test('the pretend mouse stays away when the demo is used with the keyboard', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 400 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Load' }).focus();
	await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
	await page.locator('.demo').evaluate((demo) => demo.scrollIntoView({ block: 'start' }));
	await page.waitForTimeout(1500);
	await expect(page.locator('.demo .mouse')).not.toHaveClass(/touring/);
});

test('items added to the cart fly into the cart icon', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 400 });
	await page.goto('/');
	await page.locator('.demo').hover();
	await expect(page.getByText('Hydrated')).toBeVisible(HYDRATED);

	await page.getByRole('button', { name: 'Add to cart' }).click();
	await expect(page.locator('.thumb.flying')).toHaveCount(1);

	// the badge counts the item once it lands
	await expect(page.locator('.cart b')).toHaveText('1');
	await expect(page.locator('.thumb.flying')).toHaveCount(0);
});

test('a mode picked before the site hydrates sticks', async ({ page }) => {
	// hold back SvelteKit's client JavaScript, like replay.e2e.js does
	await page.route(/\/_app\/immutable\/.*\.js$/, async (route) => {
		await new Promise((fulfil) => setTimeout(fulfil, 1500));
		await route.continue();
	});

	await page.goto('/', { waitUntil: 'domcontentloaded' });
	const standard = page.getByRole('radio', { name: /^Standard SvelteKit/ });
	await standard.check();

	// hydration renders the default mode, and the replayed change switches back to the one picked
	await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible(HYDRATED);
	await expect(standard).toBeChecked();
	await expect(page.getByRole('radio', { name: /^With EventReplay/ })).not.toBeChecked();
});

test('nothing the pretend mouse had planned happens after the visitor takes over', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 400 });
	await page.goto('/');
	await page.locator('.demo').evaluate((demo) => demo.scrollIntoView({ block: 'start' }));
	await expect(page.locator('.demo .mouse')).toHaveClass(/touring/);

	// take over in the middle of its first run, and pick the other mode
	await expect(page.getByText('3 clicks on 2 buttons')).toBeVisible(HYDRATED);
	const standard = page.getByRole('radio', { name: /^Standard SvelteKit/ });
	await standard.check();
	await expect(page.locator('.demo .mouse')).not.toHaveClass(/touring/);

	// a whole run of the pretend mouse later, the visitor's choice stands
	await page.mouse.move(5, 5);
	await page.waitForTimeout(15_000);
	await expect(standard).toBeChecked();
	await expect(page.locator('[data-tour="status"]')).toContainText('Hydrated');
});
