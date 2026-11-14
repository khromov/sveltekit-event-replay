// This file is the source of the inline <head> script that captures events before hydration.
// It is minified into `src/lib/generated/script.js` by `scripts/build-script.js` — it is never
// imported directly. The source is static (configuration arrives through the `data-config`
// attribute) so that the CSP hash stays stable across apps and options.
(() => {
	if (window.__sveltekit_event_replay) return;

	/** @type {Partial<import('../lib/types.js').CaptureConfig>} */
	let config = {};
	try {
		// `Object()` turns `null` and other non-objects into something we can destructure
		config = Object(JSON.parse(document.currentScript?.getAttribute('data-config') || '{}'));
	} catch {
		// malformed config — fall back to the defaults
	}

	let {
		events = ['click'],
		dedupe = true,
		ignore = '[data-no-replay]',
		pending = 'data-replay-pending',
		timeout = 10000
	} = config;

	// Before hydration, every form submission is a native one — replaying it would submit twice
	events = (Array.isArray(events) ? events : ['click']).filter(
		(type) => type !== 'submit' && type !== 'reset'
	);

	// An invalid selector or attribute name would throw on every event, so check them once
	try {
		if (ignore) document.documentElement.matches(ignore);
	} catch {
		ignore = '[data-no-replay]';
	}

	try {
		if (pending) document.createElement('i').setAttribute(pending, '');
	} catch {
		pending = 'data-replay-pending';
	}

	// Elements that are clicked as a whole: clicks anywhere inside one count as clicks on it
	const clickable = 'button,[role="button"],[tabindex]:not([tabindex^="-"])';

	/**
	 * Whether the browser already did something with this click (navigating, toggling, focusing,
	 * opening a popover...), in which case replaying it would do it a second time.
	 *
	 * @param {Element} target
	 */
	const native = (target) => {
		if (target.closest('a[href],area[href],[contenteditable]:not([contenteditable="false"])')) {
			return true;
		}

		// the nearest interactive element decides — e.g. a <button> inside a <summary> is a button
		const element = /** @type {HTMLElement | null} */ (
			target.closest('button,input,select,textarea,label,summary,option')
		);
		if (!element) return false;
		if (element.matches('[popovertarget],[commandfor]')) return true;

		const { localName, type } = /** @type {HTMLButtonElement} */ (element);

		if (localName === 'button' || /^(button|submit|reset|image)$/.test(type)) {
			// submit/reset buttons submit their form; without a form they do nothing
			return !!(/** @type {HTMLButtonElement} */ (element).form) && type !== 'button';
		}

		// a label toggles its control — if it has one
		if (localName === 'label') return !!(/** @type {HTMLLabelElement} */ (element).control);

		return true;
	};

	/** @type {import('../lib/types.js').CapturedEvent[]} */
	let queue = [];

	// Set once the app has hydrated: from then until the replay, captured events are held back
	// from the app, so that they can't overtake the ones captured before them
	let held = false;

	/** @param {Event} event */
	const capture = (event) => {
		const target = /** @type {Element} */ (event.target);
		if (!target?.closest || (ignore && target.closest(ignore))) return;

		let key = target;

		if (event.type === 'click') {
			if (native(target)) return;
			key = target.closest(clickable) ?? target;
		}

		if (held) event.stopImmediatePropagation();

		// impatient repeated clicks count once — other event types (keys, input...) are all kept
		if (
			dedupe &&
			event.type === 'click' &&
			queue.some((item) => item.key === key && item.event.type === 'click')
		) {
			return;
		}

		// nobody clicks 100 things in a few seconds on purpose
		if (queue.length >= 100) return;

		// the text is compared before replaying: if hydration changed it, the element may no longer
		// mean what the user clicked (e.g. a reordered list, or "Follow" that turned into "Unfollow")
		queue.push({ event, key, text: key.textContent });

		// only mark interactive elements — marking e.g. <main> after a click on empty space would
		// restyle the whole page
		if (pending && key.matches(`${clickable},input,select,textarea`)) {
			key.setAttribute(pending, '');
		}
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
	// stop buffering and clear the pending markers so the page doesn't look stuck.
	// `0`, negative numbers and non-numbers (`Infinity` arrives as `null`) wait forever
	const timer =
		timeout > 0
			? setTimeout(
					() => {
						const captured = stop();
						if (pending) for (const { key } of captured) key.removeAttribute(pending);
					},
					Math.min(timeout, 2 ** 31 - 1) // larger delays overflow and fire immediately
				)
			: undefined;

	/** @type {import('../lib/types.js').CaptureApi} */
	window.__sveltekit_event_replay = {
		stop,
		hold: () => {
			held = true;
		},
		pending
	};
})();
