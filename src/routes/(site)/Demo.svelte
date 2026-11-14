<!--
@component
A mock browser whose page takes a few seconds to "hydrate", to try the package without throttling
the network. Nothing in here uses the real capture script: the clicks are handled the way the
package would (or wouldn't) handle them.
-->
<script>
	import { onMount } from 'svelte';

	/** How long the mock page takes to load its JavaScript */
	const LOAD_TIME = 5000;

	/** @typedef {'without' | 'with'} Mode */
	/** @typedef {'cart' | 'like'} Target */

	const modes = /** @type {const} */ ([
		{ value: 'without', label: 'Without' },
		{ value: 'with', label: 'With EventReplay' }
	]);

	const no_clicks = () => ({ clicks: 0, buttons: 0, replayed: 0, lost: 0 });

	/** @type {Mode} */
	let mode = $state('with');
	let hydrated = $state(false);
	let counts = $state({ cart: 0, like: 0 });
	let gift_wrap = $state(false);

	/**
	 * The buttons clicked while the mock page loads, in the order they were first clicked. With
	 * `<EventReplay>` this is what gets replayed: like the queue of the real capture script, it
	 * holds each button once however often it was clicked
	 * @type {Target[]}
	 */
	let clicked = $state([]);

	/** What became of the clicks made while the mock page was loading, last time in each mode */
	let results = $state({ without: no_clicks(), with: no_clicks() });

	const outcome = $derived.by(() => {
		const count = mode === 'with' ? results.with.replayed : results.without.lost;
		return `${plural(count, 'click')} ${mode === 'with' ? 'replayed' : 'lost'}`;
	});

	/** @type {HTMLElement} */
	let bar;

	/** @type {HTMLElement} */
	let content;

	/** @type {Animation | undefined} */
	let loading;

	// The server-rendered demo is already in its loading state, so the first load only starts the clock
	onMount(() => {
		start();
		return () => loading?.cancel();
	});

	function start() {
		loading?.cancel();
		loading = bar.animate(
			{ transform: ['scaleX(0)', 'scaleX(1)'] },
			{ duration: LOAD_TIME, fill: 'forwards' }
		);
		loading.onfinish = hydrate;
	}

	/**
	 * Reloads the mock page: its HTML shows up right away, its handlers after `LOAD_TIME`.
	 * @param {Mode} next
	 */
	function reload(next = mode) {
		// a load that was cut short has no outcome to compare
		if (!hydrated) results[mode] = no_clicks();

		mode = next;
		results[mode] = no_clicks();
		hydrated = false;
		counts = { cart: 0, like: 0 };
		gift_wrap = false;
		clicked = [];

		if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
			content.animate({ opacity: [0, 1] }, { duration: 250, easing: 'ease-out' });
		}

		start();
	}

	function hydrate() {
		hydrated = true;

		if (mode === 'with') {
			for (const target of clicked) {
				counts[target]++;
				results.with.replayed++;
			}
		}

		clicked = [];
	}

	/** @param {Target} target */
	function click(target) {
		if (hydrated) {
			counts[target]++;
			return;
		}

		const result = results[mode];
		result.clicks++;

		if (!clicked.includes(target)) {
			clicked.push(target);
			result.buttons++;
		}

		// no handler is listening yet, and nothing remembers the click
		if (mode === 'without') result.lost++;
	}

	/**
	 * The attribute that `<EventReplay>` sets on elements with a click waiting to be replayed
	 * @param {Target} target
	 */
	function pending(target) {
		return mode === 'with' && clicked.includes(target) ? '' : undefined;
	}

	/**
	 * @param {number} count
	 * @param {string} noun
	 */
	function plural(count, noun) {
		return `${count} ${noun}${count === 1 ? '' : 's'}`;
	}
</script>

<div class="demo">
	<fieldset class="modes">
		<legend class="visually-hidden">Mock page</legend>

		{#each modes as { value, label } (value)}
			{@const result = results[value]}

			<label class="mode" class:selected={mode === value}>
				<span class="name">
					<input
						type="radio"
						name="mode"
						{value}
						checked={mode === value}
						onchange={() => reload(value)}
					/>
					{label}
				</span>

				{#if value === 'with'}
					<span class="result" class:good={result.replayed > 0}>
						<b>{result.replayed}</b> replayed
					</span>
				{:else}
					<span class="result" class:bad={result.lost > 0}>
						<b>{result.lost}</b> lost
					</span>
				{/if}

				<span class="clicks">
					{plural(result.clicks, 'click')}{result.clicks
						? ` on ${plural(result.buttons, 'button')}`
						: ''}
				</span>
			</label>
		{/each}
	</fieldset>

	<div class="browser">
		<div class="toolbar">
			<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>

			<button type="button" class="reload" onclick={() => reload()}>
				<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
					<path
						d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
				Reload
			</button>

			<span class="address">shop.example/socks</span>
		</div>

		<div class="progress" aria-hidden="true">
			<div class="bar" class:done={hydrated} bind:this={bar}></div>
		</div>

		<div class="page" bind:this={content}>
			<p class="product">
				<span class="thumb" aria-hidden="true"></span>
				<span><strong>Wool socks</strong><br />$12</span>
			</p>

			<p class="action">
				<button
					type="button"
					class="primary"
					data-replay-pending={pending('cart')}
					onclick={() => click('cart')}
				>
					Add to cart
				</button>

				{#key counts.cart}
					<output class:pop={counts.cart > 0}>{counts.cart} in cart</output>
				{/key}
			</p>

			<p class="action">
				<button type="button" data-replay-pending={pending('like')} onclick={() => click('like')}>
					Like
				</button>

				{#key counts.like}
					<output class:pop={counts.like > 0}>{plural(counts.like, 'like')}</output>
				{/key}
			</p>

			<label class="gift"><input type="checkbox" bind:checked={gift_wrap} /> Gift wrap</label>
		</div>

		<p class="status" class:hydrated role="status">
			<span class="indicator" aria-hidden="true"></span>

			{#if hydrated}
				Hydrated<span class="visually-hidden">, {outcome}</span>
			{:else}
				Loading JavaScript…
			{/if}
		</p>
	</div>
</div>

<style>
	.demo {
		display: grid;
		gap: 0.75rem;
	}

	.modes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.mode {
		display: grid;
		align-content: start;
		min-width: 0;
		padding: 0.75rem 0.875rem 0.875rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background: var(--surface);
		cursor: pointer;
	}

	.mode.selected {
		border-color: var(--text);
		box-shadow: 0 0 0 1px var(--text);
	}

	.name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 1.3;
	}

	.name input {
		flex: none;
		width: 1rem;
		height: 1rem;
		margin: 0;
		accent-color: var(--text);
	}

	.result {
		margin-top: 0.75rem;
		font-size: 0.875rem;
		line-height: 1.2;
		color: var(--muted);
	}

	.result b {
		font-size: 2rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.03em;
	}

	.result.good {
		color: var(--good);
	}

	.result.bad {
		color: var(--bad);
	}

	.clicks {
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	.browser {
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background: var(--surface);
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.04),
			0 12px 32px -16px rgb(0 0 0 / 0.16);
	}

	.toolbar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--subtle);
	}

	.dots {
		display: flex;
		gap: 0.375rem;
		margin: 0 0.375rem;
	}

	.dots i {
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: var(--border);
	}

	.reload,
	.address {
		display: flex;
		align-items: center;
		height: 2.25rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--surface);
		font-size: 0.8125rem;
	}

	.reload {
		flex: none;
		gap: 0.375rem;
		padding: 0 0.75rem;
		font-weight: 500;
		cursor: pointer;
	}

	.address {
		flex: 1;
		min-width: 0;
		padding: 0 0.75rem;
		overflow: hidden;
		font-family: var(--mono);
		white-space: nowrap;
		color: var(--muted);
	}

	.progress {
		height: 2px;
		background: var(--border);
	}

	.bar {
		height: 100%;
		background: var(--accent);
		transform: scaleX(0);
		transform-origin: left;
	}

	.bar.done {
		opacity: 0;
		transition: opacity 0.3s 0.2s;
	}

	.page {
		display: grid;
		gap: 0.875rem;
		padding: 1.25rem;
	}

	.page p {
		margin: 0;
	}

	.product {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.25rem;
		line-height: 1.4;
	}

	.product span:last-child {
		color: var(--muted);
	}

	.product strong {
		font-weight: 600;
		color: var(--text);
	}

	.thumb {
		flex: none;
		width: 3rem;
		height: 3rem;
		border-radius: 0.5rem;
		background: repeating-linear-gradient(135deg, var(--subtle) 0 6px, var(--border) 6px 7px);
	}

	.action {
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.action button {
		flex: none;
		width: 8.5rem;
		height: 2.75rem;
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		background: var(--surface);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
	}

	.action button.primary {
		border-color: var(--text);
		background: var(--text);
		color: var(--bg);
	}

	/* `cursor: pointer` above would otherwise win over the global pending style */
	.action button[data-replay-pending] {
		cursor: progress;
	}

	.action output {
		display: inline-block;
		font-size: 0.9375rem;
		font-variant-numeric: tabular-nums;
		color: var(--muted);
	}

	.action output.pop {
		animation: pop 0.6s ease-out;
	}

	@keyframes pop {
		from {
			color: var(--good);
			transform: scale(1.2);
		}
	}

	.gift {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: fit-content;
		min-height: 1.75rem;
		font-size: 0.9375rem;
		cursor: pointer;
	}

	.gift input {
		width: 1.125rem;
		height: 1.125rem;
		margin: 0;
		accent-color: var(--text);
	}

	.status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		padding: 0.5rem 0.875rem;
		border-top: 1px solid var(--border);
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.indicator {
		width: 0.75rem;
		height: 0.75rem;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	.status.hydrated {
		color: var(--text);
	}

	.status.hydrated .indicator {
		border-color: var(--good);
		background: var(--good);
		animation: none;
		transform: scale(0.67);
	}

	@keyframes spin {
		to {
			transform: rotate(1turn);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.indicator,
		.action output.pop {
			animation: none;
		}
	}

	@media (max-width: 30rem) {
		.modes {
			gap: 0.5rem;
		}

		.mode {
			padding: 0.625rem 0.75rem 0.75rem;
		}

		.dots {
			display: none;
		}

		.page {
			padding: 1rem;
		}
	}
</style>
