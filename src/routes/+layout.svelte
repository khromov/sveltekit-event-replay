<script>
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { EventReplay } from '#lib';

	/** @type {{ children: import('svelte').Snippet }} */
	let { children } = $props();

	// The demo reads options from the URL so the e2e tests can exercise every flag,
	// e.g. /?events=click,input&dedupe=false&timeout=500
	const params = page.url.searchParams;
	const events = params.get('events')?.split(',') ?? ['click'];
	const dedupe = params.get('dedupe') !== 'false';
	const timeout = Number(params.get('timeout') ?? 10000);

	/** @type {Event[] | null} */
	let replayed = $state(null);

	// Signal for the e2e tests: the app has hydrated and the router has started
	afterNavigate(({ type }) => {
		if (type === 'enter') setTimeout(() => (document.documentElement.dataset.hydrated = ''));
	});
</script>

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
