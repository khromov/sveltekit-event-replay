/** @import { CapturedEvent } from './types.js' */
import { flushSync } from 'svelte';

/** The events this package has dispatched. A WeakSet, so it never keeps an event alive */
const replayed = new WeakSet();

/**
 * Whether `event` is a replay of an interaction made before the page hydrated, rather than one the
 * browser dispatched just now.
 *
 * Replayed events are synthetic (`event.isTrusted` is `false`), so a handler that needs a real user
 * gesture, like opening a popup or writing to the clipboard, can check this and skip the replay,
 * letting the user click again.
 *
 * @example
 * ```js
 * function share(event) {
 * 	if (isReplayed(event)) return;
 * 	navigator.share({ url: location.href });
 * }
 * ```
 *
 * @param {Event} event
 * @returns {boolean}
 */
export function isReplayed(event) {
	return replayed.has(event);
}

/**
 * Stops the inline capture script and hands over what it captured. Returns `null` if the script
 * never ran (client-side rendered page, already replayed...).
 *
 * @returns {{ captured: CapturedEvent[], pending: string | false } | null}
 */
export function take() {
	const api = window.__sveltekit_event_replay;

	// also guards against DOM clobbering (an element with id="__sveltekit_event_replay")
	if (typeof api?.stop !== 'function') return null;

	delete window.__sveltekit_event_replay;
	return { captured: api.stop(), pending: api.pending };
}

/**
 * Re-dispatches captured events on their original targets, in order.
 *
 * @param {ReturnType<typeof take>} taken
 * @returns {Event[]} the events that were dispatched
 */
export function dispatch(taken) {
	/** @type {Event[]} */
	const dispatched = [];
	if (!taken) return dispatched;

	// Compare texts before replaying anything — replayed handlers may change them on purpose
	// (a button showing a count). A click whose element's text changed in the meantime may no
	// longer mean what the user clicked: a reordered list, or "Follow" that turned into "Unfollow"
	const changed = taken.captured.map(({ key, text }) => text !== null && key.textContent !== text);

	for (const [index, { event, key, value, checked }] of taken.captured.entries()) {
		if (taken.pending) key.removeAttribute(taken.pending);

		const target = /** @type {HTMLInputElement} */ (event.target);

		// Skip events whose element hydration replaced (e.g. after a mismatch), changed, or disabled
		if (!target.isConnected || changed[index] || target.closest(':disabled')) continue;

		try {
			// put back what the field held when the event happened, in case hydration reset it
			if (value !== undefined && target.value !== value) target.value = value;
			if (checked !== undefined && target.checked !== checked) target.checked = checked;

			// the event init dictionaries (MouseEventInit, InputEventInit...) read their fields off the original
			const EventConstructor = /** @type {new (type: string, init: Event) => Event} */ (
				event.constructor
			);
			const copy = new EventConstructor(event.type, event);

			replayed.add(copy);
			target.dispatchEvent(copy);
			dispatched.push(copy);

			// apply the handler's state changes to the DOM (e.g. `disabled={busy}`) before the next event
			flushSync();
		} catch (error) {
			// some event types can't be constructed (e.g. TextEvent) — report it and keep going
			if (typeof reportError === 'function') reportError(error);
			else console.error(error);
		}
	}

	return dispatched;
}

/**
 * Replays everything the inline script captured, in order, one task from now — once SvelteKit's
 * router has started. Until then, new events that would be captured are held back from the app
 * and replayed after the earlier ones, so nothing runs twice or out of order.
 *
 * `<EventReplay>` does this for you once SvelteKit has hydrated the page. Call it yourself only if
 * you render {@link SCRIPT} some other way, e.g. by pasting it into `app.html`.
 *
 * Replayed events are synthetic: they reach Svelte's handlers (delegated `onclick` included) and
 * `addEventListener` listeners, with `event.isTrusted` set to `false`.
 *
 * @returns {Promise<Event[]>} the events that were dispatched (empty if there was nothing to replay)
 */
export function replay() {
	const api = window.__sveltekit_event_replay;
	if (typeof api?.hold === 'function') api.hold();

	return new Promise((fulfil) => setTimeout(() => fulfil(dispatch(take()))));
}
