<!--
@component
Captures clicks (and optionally other events) that happen before SvelteKit hydrates the page, and
replays them once it has. Render it once, in your root `+layout.svelte`:

```svelte
<script>
	import { EventReplay } from 'sveltekit-event-replay';
	let { children } = $props();
</script>

<EventReplay />

{@render children()}
```
-->
<script>
	import { afterNavigate } from '$app/navigation';
	import { SCRIPT } from './generated/script.js';
	import { replay } from './replay.js';

	/**
	 * @typedef {object} Props
	 * @property {string[]} [events]
	 * Event types to capture before hydration. Defaults to `['click']`. Links, form controls,
	 * labels, `<summary>` and form submit buttons are never captured for `click`, since the browser
	 * already handled those. Add `'input'` / `'change'` to also run `oninput` / `onchange` handlers
	 * for fields that were edited before hydration.
	 * @property {boolean} [dedupe]
	 * Replay at most one event per element and event type, so impatient repeated clicks on e.g. a
	 * "Buy" button run its handler once. Defaults to `true`.
	 * @property {string | false} [ignore]
	 * CSS selector for elements (and their descendants) that should never be captured. Defaults to
	 * `'[data-no-replay]'`.
	 * @property {string | false} [pending]
	 * Attribute set on elements that have an event waiting to be replayed, for styling. Defaults to
	 * `'data-replay-pending'`. Pass `false` to disable. Use a name your elements don't otherwise
	 * have: it is removed when the event is replayed.
	 * @property {number} [timeout]
	 * Milliseconds to wait for hydration before dropping captured events and clearing `pending`
	 * markers. `0` waits forever. Defaults to `10000`.
	 * @property {(events: Event[]) => void} [onreplay]
	 * Called after hydration with the events that were replayed (an empty array if there were none).
	 */

	/** @type {Props} */
	let {
		events = ['click'],
		dedupe = true,
		ignore = '[data-no-replay]',
		pending = 'data-replay-pending',
		timeout = 10000,
		onreplay
	} = $props();

	// The script runs once, when the server-rendered HTML is parsed. On the client this markup is
	// only hydrated (or inserted via innerHTML on later navigations, which never executes scripts)
	const tag = $derived.by(() => {
		const config = JSON.stringify({ events, dedupe, ignore, pending, timeout })
			.replaceAll('&', '&amp;')
			.replaceAll('"', '&quot;')
			.replaceAll('<', '&lt;');

		return `<script data-config="${config}">${SCRIPT}</` + 'script>';
	});

	afterNavigate(({ type }) => {
		if (type === 'enter') replay().then((events) => onreplay?.(events));
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, prebuilt script; config is escaped -->
	{@html tag}
</svelte:head>
