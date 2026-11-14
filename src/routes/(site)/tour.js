/**
 * Plays the demo with a pretend mouse until `signal` aborts: it reloads the mock page, clicks the
 * buttons while it loads, waits for the result, then does the same in the other mode. It clicks
 * the demo's real controls (marked with `data-tour`), so the demo does what it would for a visitor.
 *
 * @param {HTMLElement} root the demo, which the pretend mouse is positioned in
 * @param {HTMLElement} mouse the pretend mouse; its tip is at its top left corner
 * @param {AbortSignal} signal
 */
export async function tour(root, mouse, signal) {
	/** @param {string} name */
	const find = (name) => /** @type {HTMLElement} */ (root.querySelector(`[data-tour="${name}"]`));

	/** @param {number} ms */
	const wait = (ms) =>
		new Promise((fulfil, reject) => {
			if (signal.aborted) return reject(signal.reason);
			const timer = setTimeout(fulfil, ms);
			signal.addEventListener(
				'abort',
				() => {
					clearTimeout(timer);
					reject(signal.reason);
				},
				{ once: true }
			);
		});

	/**
	 * @param {string} name
	 * @param {number} [x] where to point, as a fraction of the element's width
	 * @param {number} [y] where to point, as a fraction of the element's height
	 */
	const point_at = (name, x = 0.55, y = 0.6) => {
		const area = root.getBoundingClientRect();
		const rect = find(name).getBoundingClientRect();
		const left = rect.left - area.left + rect.width * x;
		const top = rect.top - area.top + rect.height * y;
		mouse.style.transform = `translate(${left}px, ${top}px)`;
	};

	/** @param {string} name @param {number} [x] @param {number} [y] */
	const move = async (name, x, y) => {
		point_at(name, x, y);
		await wait(750);
	};

	/** @param {string} name */
	const press = async (name) => {
		mouse.firstElementChild?.animate(
			{ transform: ['scale(0.2)', 'scale(1)'], opacity: [0.9, 0] },
			{ duration: 500, easing: 'ease-out' }
		);
		// click a mode's radio itself, which (unlike clicking its label) can't move focus into the
		// demo, which would count as the visitor taking over
		const element = find(name);
		(element.querySelector('input') ?? element).click();
		await wait(300);
	};

	// appear next to the status bar, without gliding in from the corner
	mouse.style.transition = 'none';
	point_at('status', 0.8, 0.5);
	mouse.getBoundingClientRect();
	mouse.style.transition = '';
	await wait(900);

	let mode = 'with';

	while (true) {
		// a fresh load of the mock page, in this mode
		const radio = /** @type {HTMLInputElement} */ (find(mode).querySelector('input'));
		const control = radio.checked ? 'reload' : mode;
		await move(control);
		await press(control);

		// click while it loads: twice on one button, to show that repeats count once
		await move('cart');
		await press('cart');
		await press('cart');
		await move('like');
		await press('like');

		// step aside and watch the result
		await move('status', 0.35, 0.5);
		while (!find('status').classList.contains('hydrated')) await wait(100);
		await wait(2500);

		mode = mode === 'with' ? 'without' : 'with';
	}
}
