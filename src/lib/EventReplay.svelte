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
<script module>
	// Only the first page load has anything to replay — later mounts (e.g. when the component is
	// rendered in a layout that client-side navigation remounts) leave it alone
	let mounted = false;
</script>

<script>
	import { onMount } from 'svelte';
	import { SCRIPT } from './generated/script.js';
	import { replay } from './replay.js';

	/**
	 * @typedef {object} Props
	 * @property {Array<keyof WindowEventMap | (string & {})>} [events]
	 * Event types to capture before hydration. Defaults to `['click']`. Links, form controls,
	 * labels, `<summary>`, popover/command buttons and form submit buttons are never captured for
	 * `click`, since the browser already handled those, and `submit`/`reset` are never captured. Add
	 * `'input'` / `'change'` to also run `oninput` / `onchange` handlers for fields that were edited
	 * before hydration, and `'pointerdown'` for UI libraries whose menus open on pointer down.
	 * @property {boolean} [dedupe]
	 * Replay at most one click (and one pointer or mouse press) per element, so impatient repeated
	 * clicks on e.g. a "Buy" button run its handler once. Other event types are always replayed in
	 * full. Defaults to `true`.
	 * @property {string | false} [ignore]
	 * CSS selector for elements (and their descendants) that should never be captured. Defaults to
	 * `'[data-no-replay]'`.
	 * @property {string | false} [pending]
	 * Attribute set on interactive elements that have an event waiting to be replayed, for styling.
	 * Defaults to `'data-replay-pending'`. Pass `false` to disable. Use a name your elements don't
	 * otherwise have: it is removed when the event is replayed.
	 * @property {number} [timeout]
	 * Milliseconds to wait for hydration before dropping captured events and clearing `pending`
	 * markers. `0` waits forever. Defaults to `10000`.
	 * @property {(events: Event[]) => void} [onreplay]
	 * Called once after hydration with the events that were replayed (an empty array if there were
	 * none).
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

	// Hold new events back from the app as soon as it starts hydrating. With `experimental.async`,
	// handlers can already be listening while the page awaits something before mounting, and a
	// click made then would otherwise run now and again when it's replayed
	if (typeof window !== 'undefined' && !mounted) window.__sveltekit_event_replay?.hold?.();

	// onMount rather than afterNavigate: with `experimental.async`, a page that awaits during
	// hydration can mount after SvelteKit has already fired its 'enter' navigation callbacks.
	// replay() waits a task, by which point SvelteKit has finished starting up
	onMount(() => {
		if (mounted) return;
		mounted = true;
		replay().then((events) => onreplay?.(events));
	});
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static, prebuilt script; config is escaped -->
	{@html tag}
</svelte:head>
