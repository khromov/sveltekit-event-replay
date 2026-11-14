/** @import { CapturedEvent } from './types.js' */

/**
 * Stops the inline capture script and hands over what it captured. Returns `null` if the script
 * never ran (client-side rendered page, already replayed...).
 *
 * @returns {{ captured: CapturedEvent[], pending: string | false } | null}
 */
export function take() {
	const api = window.__sveltekit_event_replay;
	if (!api) return null;

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

	for (const { event, key } of taken.captured) {
		if (taken.pending) key.removeAttribute(taken.pending);

		const target = /** @type {Element} */ (event.target);

		// hydration may have replaced the node (e.g. after a mismatch) — there's nothing to replay on
		if (!target.isConnected) continue;

		// the event init dictionaries (MouseEventInit, InputEventInit...) read their fields off the original
		const EventConstructor = /** @type {new (type: string, init: Event) => Event} */ (
			event.constructor
		);
		const copy = new EventConstructor(event.type, event);

		target.dispatchEvent(copy);
		dispatched.push(copy);
	}

	return dispatched;
}

/**
 * Stops the inline capture script and re-dispatches everything it captured, in order.
 *
 * `<EventReplay>` does this for you once SvelteKit has hydrated the page. Call it yourself only if
 * you render {@link SCRIPT} some other way, e.g. by pasting it into `app.html`.
 *
 * Replayed events are synthetic: they reach Svelte's handlers (delegated `onclick` included) and
 * `addEventListener` listeners, but `event.isTrusted` is `false` and they don't count as user
 * activation, so APIs like `window.open` or the clipboard may refuse them.
 *
 * @returns {Event[]} the events that were dispatched
 */
export function replay() {
	return dispatch(take());
}
