// This file is the source of the inline <head> script that captures events before hydration.
// It is minified into `src/lib/generated/script.js` by `scripts/build-script.js` — it is never
// imported directly. The source is static (configuration arrives through the `data-config`
// attribute) so that the CSP hash stays stable across apps and options.
(() => {
	if (window.__sveltekit_event_replay) return;

	/** @type {Partial<import('../lib/types.js').CaptureConfig>} */
	let config = {};
	try {
		config = JSON.parse(document.currentScript?.getAttribute('data-config') || '{}');
	} catch {
		// malformed config — fall back to defaults
	}

	const {
		events = ['click'],
		dedupe = true,
		ignore = '[data-no-replay]',
		pending = 'data-replay-pending',
		timeout = 10000
	} = config;

	// Clicking these already did something natively (navigation, toggling, focusing...),
	// so replaying the click after hydration would do it a second time
	const native =
		'a[href],area[href],input,select,textarea,label,summary,option,[contenteditable]:not([contenteditable="false"])';

	/** @type {import('../lib/types.js').CapturedEvent[]} */
	let queue = [];

	/** @param {Event} event */
	const capture = (event) => {
		const target = /** @type {Element} */ (event.target);
		if (!target?.closest || (ignore && target.closest(ignore))) return;

		let key = target;

		if (event.type === 'click') {
			if (target.closest(native)) return;

			// submit/reset buttons that belong to a form are handled by the browser
			const button = target.closest('button');
			if (button?.form && button.type !== 'button') return;

			// treat clicks anywhere inside the same button as clicks on that button
			key = target.closest('button,[role="button"]') ?? target;
		}

		if (dedupe && queue.some((item) => item.key === key && item.event.type === event.type)) {
			return;
		}

		queue.push({ event, key });
		if (pending) key.setAttribute(pending, '');
	};

	const stop = () => {
		clearTimeout(timer);
		for (const type of events) removeEventListener(type, capture, true);
		const captured = queue;
		queue = [];
		return captured;
	};

	for (const type of events) addEventListener(type, capture, true);

	// If hydration never happens (`csr = false`, a failed chunk, a very slow network),
	// stop buffering and clear the pending markers so the page doesn't look stuck
	const timer = timeout
		? setTimeout(() => {
				if (pending) for (const { key } of stop()) key.removeAttribute(pending);
			}, timeout)
		: undefined;

	/** @type {import('../lib/types.js').CaptureApi} */
	window.__sveltekit_event_replay = { stop, pending };
})();
