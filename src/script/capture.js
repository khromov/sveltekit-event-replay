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

	/**
	 * Elements that are clicked as a whole: clicks anywhere inside one count as clicks on it. Widget
	 * roles rather than `tabindex`, which scroll containers like code blocks have too
	 * @param {Element} element
	 */
	const clickable = (element) =>
		element.localName === 'button' ||
		/^(button|checkbox|link|menuitem\w*|option|radio|switch|tab|treeitem)$/.test(
			element.getAttribute('role') ?? ''
		);

	/** @param {Element} target */
	const clicked = (target) => {
		for (let element = /** @type {Element | null} */ (target); element;) {
			if (clickable(element)) return element;
			element = element.parentElement;
		}
		return target;
	};

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

		// clicks, and the pointer and mouse presses that some UI libraries act on instead
		const press = /^(click|(pointer|mouse)(down|up))$/.test(event.type);

		if (press) {
			if (native(target)) return;
			key = clicked(target);
		}

		if (held) event.stopImmediatePropagation();

		// impatient repeated presses count once — other event types (keys, input...) are all kept
		if (
			dedupe &&
			press &&
			queue.some((item) => item.key === key && item.event.type === event.type)
		) {
			return;
		}

		// Only the latest `input` per field is kept: handlers read the field's value, and replaying
		// every keystroke would run them with each half-typed value in turn (a search filtering a list
		// down to nothing and back, removing the button the user clicked next)
		if (event.type === 'input') {
			queue = queue.filter((item) => item.event.type !== 'input' || item.event.target !== target);
		}

		// generous enough for a sentence typed with `keydown` on, and then some clicks
		if (queue.length >= 500) return;

		/** @type {import('../lib/types.js').CapturedEvent} */
		const item = { event, key, text: null };

		if (press) {
			// what the press was about, checked before replaying. Hydration may have reused this node
			// for something else: a reordered list, "Follow" that turned into "Unfollow". With a
			// `data-replay-key` (say, a product id) that is compared; otherwise the text of a button
			// or widget is. Other elements' text changes too often to go by (timestamps, counts...)
			const owner = target.closest('[data-replay-key]');
			if (owner) item.id = owner.getAttribute('data-replay-key');
			else if (clickable(key)) item.text = key.textContent;
		} else if (/^(input|select|textarea)$/.test(target.localName)) {
			// what the field held at this point, put back before replaying: hydration may reset it to
			// what the server rendered (a <select> with `value={...}`), and handlers read it
			// (a file input's value can't be set, and a multiple <select> has more than one)
			const field = /** @type {HTMLInputElement} */ (target);
			if (field.type !== 'file' && !field.multiple) item.value = field.value;
			item.checked = field.checked;
		}

		queue.push(item);

		// only mark interactive elements — marking e.g. <main> after a click on empty space would
		// restyle the whole page
		if (pending && (clickable(key) || /^(input|select|textarea)$/.test(key.localName))) {
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
