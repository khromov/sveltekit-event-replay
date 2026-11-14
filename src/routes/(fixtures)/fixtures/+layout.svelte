<script>
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { EventReplay } from '#lib';

	/** @type {{ children: import('svelte').Snippet }} */
	let { children } = $props();

	// These pages are the fixtures of the e2e tests. They are prerendered, so each one fixes its
	// options in its `load` function (see e.g. no-dedupe/+page.js) instead of reading them from the URL
	const { events, dedupe, timeout } = page.data.replay ?? {};

	/** @type {Event[] | null} */
	let replayed = $state(null);

	// Signal for the e2e tests: the app has hydrated and the router has started
	afterNavigate(({ type }) => {
		if (type === 'enter') setTimeout(() => (document.documentElement.dataset.hydrated = ''));
	});
</script>

<svelte:head>
	<title>e2e fixture</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<EventReplay {events} {dedupe} {timeout} onreplay={(events) => (replayed = events)} />

<main>
	{@render children()}

	<p class="status" id="replayed">
		{#if replayed}
			Replayed {replayed.length} event{replayed.length === 1 ? '' : 's'} after hydration{replayed.length
				? `: ${replayed.map((e) => e.type).join(', ')}`
				: ''}
		{:else}
			Waiting for hydration…
		{/if}
	</p>
</main>

<style>
	:global(body) {
		font-family: system-ui, sans-serif;
		line-height: 1.5;
		margin: 0;
		padding: 2rem 1rem;
		color: #1d1d1f;
		background: #fff;
	}

	main {
		max-width: 42rem;
		margin: 0 auto;
	}

	.status {
		margin-top: 2rem;
		color: #555;
		font-size: 0.875rem;
	}

	:global([data-replay-pending]) {
		cursor: progress;
		outline: 2px dashed #ff3e00;
		outline-offset: 2px;
	}
</style>
