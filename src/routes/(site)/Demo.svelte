<!--
@component
A mock browser whose page takes a few seconds to "hydrate", to try the package without throttling
the network. Nothing in here uses the real capture script: the clicks are handled the way the
package would (or wouldn't) handle them.
-->
<script>
	import { onMount } from 'svelte';
	import { tour } from './tour.js';

	/** How long the mock page takes to load its JavaScript */
	const LOAD_TIME = 5000;

	/** @typedef {'without' | 'with'} Mode */
	/** @typedef {'cart' | 'like'} Target */

	const modes = /** @type {const} */ ([
		{ value: 'without', label: 'Standard SvelteKit' },
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

	/** @type {HTMLElement} */
	let thumb;

	/** @type {HTMLElement} */
	let cart;

	/** How many items have landed in the cart icon, which trails `counts.cart` while they fly */
	let landed = $state(0);

	/** @typedef {{ id: number, left: number, top: number, dx: number, dy: number }} Flight */

	/**
	 * Copies of the product picture on their way to the cart
	 * @type {Flight[]}
	 */
	let flights = $state([]);
	let next_flight = 0;

	/** @type {Animation | undefined} */
	let loading;

	/** @type {HTMLElement} */
	let root;

	/** @type {HTMLElement} */
	let mouse;

	/** Whether the pretend mouse is playing the demo */
	let touring = $state(false);

	/** Whether the mock page has been loaded at all. It starts out blank, waiting for "Load" */
	let loaded = $state(false);

	onMount(() => {
		const controller = new AbortController();
		const stop = () => controller.abort();

		// Once the demo scrolls into view, a pretend mouse plays it, starting with "Load". When the
		// visitor reaches for the demo, the mouse goes away, and the page loads if it hadn't yet.
		// Visitors who'd rather not see motion, or already rest their pointer on the demo, get the
		// loaded page straight away
		const reached = root.matches(':hover') || root.contains(document.activeElement);

		if (!matchMedia('(prefers-reduced-motion: reduce)').matches && !reached) {
			const take_over = () => {
				stop();
				if (!loaded) reload();
			};

			for (const type of ['pointerenter', 'pointerdown', 'focusin']) {
				root.addEventListener(type, take_over, { once: true, signal: controller.signal });
			}

			const observer = new IntersectionObserver(
				([entry]) => {
					if (!entry.isIntersecting) return;
					observer.disconnect();
					touring = true;
					tour(root, mouse, controller.signal)
						.catch(() => {})
						.finally(() => (touring = false));
				},
				{ rootMargin: '0px 0px -35% 0px' }
			);

			observer.observe(root);
			controller.signal.addEventListener('abort', () => observer.disconnect());
		} else {
			reload();
		}

		return () => {
			loading?.cancel();
			stop();
		};
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
	 * (Re)loads the mock page: its HTML shows up right away, its handlers after `LOAD_TIME`.
	 * @param {Mode} next
	 */
	function reload(next = mode) {
		loaded = true;

		// a load that was cut short has no outcome to compare
		if (!hydrated) results[mode] = no_clicks();

		mode = next;
		results[mode] = no_clicks();
		hydrated = false;
		counts = { cart: 0, like: 0 };
		landed = 0;
		flights = [];
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
				add(target);
				results.with.replayed++;
			}
		}

		clicked = [];
	}

	/**
	 * What the mock page's handlers do once they're listening
	 * @param {Target} target
	 */
	function add(target) {
		counts[target]++;
		if (target === 'cart') fly();
	}

	/** Sends a copy of the product picture along an arc into the cart icon */
	function fly() {
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return land();

		const page = content.getBoundingClientRect();
		const from = thumb.getBoundingClientRect();
		const to = cart.getBoundingClientRect();

		flights.push({
			id: next_flight++,
			left: from.left - page.left,
			top: from.top - page.top,
			dx: to.left + to.width / 2 - (from.left + from.width / 2),
			dy: to.top + to.height / 2 - (from.top + from.height / 2)
		});
	}

	/**
	 * Animates one flying copy of the product picture, and lands it in the cart
	 * @param {Flight} flight
	 * @returns {import('svelte/attachments').Attachment<HTMLElement>}
	 */
	function travel({ id, dx, dy }) {
		return (element) => {
			// a parabola that rises a little above the straight line between the two
			const keyframes = Array.from({ length: 13 }, (_, i) => {
				const t = i / 12;
				const x = dx * t;
				const y = dy * t - 48 * 4 * t * (1 - t);
				return {
					transform: `translate(${x}px, ${y}px) scale(${1 - 0.7 * t})`,
					opacity: 1 - 0.4 * t
				};
			});

			const animation = element.animate(keyframes, { duration: 650, easing: 'ease-in-out' });
			animation.onfinish = () => {
				flights = flights.filter((flight) => flight.id !== id);
				land();
			};

			// a reload clears `flights`, which removes copies still in the air without landing them
			return () => animation.cancel();
		};
	}

	function land() {
		landed++;
		cart.animate({ transform: ['scale(1)', 'scale(1.2)', 'scale(1)'] }, { duration: 300 });
	}

	/** @param {Target} target */
	function click(target) {
		if (hydrated) {
			add(target);
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

<div class="demo" bind:this={root}>
	<fieldset class="modes">
		<legend class="visually-hidden">Mock page</legend>

		{#each modes as { value, label } (value)}
			{@const result = results[value]}

			<label class="mode" class:selected={mode === value} data-tour={value}>
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

			<button type="button" class="reload" data-tour="reload" onclick={() => reload()}>
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
				{loaded ? 'Reload' : 'Load'}
			</button>

			<span class="address">shop.example/socks</span>
		</div>

		<div class="progress" aria-hidden="true">
			<div class="bar" class:done={hydrated} bind:this={bar}></div>
		</div>

		<!-- kept in the layout while blank, so the demo doesn't change height when it loads -->
		<div class="page" class:blank={!loaded} inert={!loaded} bind:this={content}>
			<p class="product">
				<span class="thumb" aria-hidden="true" bind:this={thumb}></span>
				<span><strong>Wool socks</strong><br />$12</span>
			</p>

			<!-- the mock shop's cart; "N in cart" next to the button says the same for screen readers,
			     and the status bar says how many clicks were lost -->
			<span class="corner" aria-hidden="true">
				<span class="cart" bind:this={cart}>
					<svg viewBox="0 0 24 24" width="26" height="26">
						<path
							d="M2.5 3.5h2.4l2.2 10.6a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7.5H5.6"
						/>
						<circle cx="9.5" cy="19.5" r="1.4" />
						<circle cx="17.5" cy="19.5" r="1.4" />
					</svg>
					{#if landed}
						{#key landed}
							<b>{landed}</b>
						{/key}
					{/if}
				</span>

				{#if mode === 'without' && hydrated && results.without.lost > 0}
					<span class="lost">
						<svg viewBox="0 0 24 24" width="22" height="22">
							<circle cx="12" cy="12" r="9.5" />
							<circle class="eye" cx="8.8" cy="10" r="1.1" />
							<circle class="eye" cx="15.2" cy="10" r="1.1" />
							<path d="M8.3 16.6a4.6 4.6 0 0 1 7.4 0" />
						</svg>
						Events lost
					</span>
				{/if}
			</span>

			{#each flights as flight (flight.id)}
				<span
					class="thumb flying"
					aria-hidden="true"
					style:left="{flight.left}px"
					style:top="{flight.top}px"
					{@attach travel(flight)}
				></span>
			{/each}

			<p class="action">
				<button
					type="button"
					class="primary"
					data-tour="cart"
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
				<button
					type="button"
					data-tour="like"
					data-replay-pending={pending('like')}
					onclick={() => click('like')}
				>
					Like
				</button>

				{#key counts.like}
					<output class:pop={counts.like > 0}>{plural(counts.like, 'like')}</output>
				{/key}
			</p>

			<label class="gift"><input type="checkbox" bind:checked={gift_wrap} /> Gift wrap</label>
		</div>

		<p class="status" class:idle={!loaded} class:hydrated role="status" data-tour="status">
			<span class="indicator" aria-hidden="true"></span>

			{#if !loaded}
				Idle
			{:else if hydrated}
				Hydrated<span class="visually-hidden">, {outcome}</span>
			{:else}
				Loading JavaScript…
			{/if}
		</p>
	</div>

	<!-- the pretend mouse that plays the demo until the visitor reaches for it -->
	<div class="mouse" class:touring aria-hidden="true" bind:this={mouse}>
		<span class="pulse"></span>
		<svg viewBox="0 0 16 22" width="16" height="22">
			<path d="M1 1v17l4.6-4.3 3 6.8 2.6-1.1-3-6.7H14z" />
		</svg>
	</div>
</div>

<style>
	.demo {
		position: relative;
		display: grid;
		gap: 0.75rem;
	}

	.mouse {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 2;
		pointer-events: none;
		opacity: 0;
		transition:
			transform 0.7s cubic-bezier(0.45, 0, 0.2, 1),
			opacity 0.3s;
	}

	.mouse.touring {
		opacity: 1;
	}

	.mouse svg {
		display: block;
		margin: -1px 0 0 -1px;
		filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.25));
	}

	.mouse path {
		fill: var(--text);
		stroke: var(--surface);
		stroke-width: 1.5;
		stroke-linejoin: round;
	}

	.pulse {
		position: absolute;
		top: -18px;
		left: -18px;
		width: 36px;
		height: 36px;
		border: 2px solid var(--accent);
		border-radius: 50%;
		opacity: 0;
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
		position: relative;
		display: grid;
		gap: 0.875rem;
		padding: 1.25rem;
	}

	/* the cart, and what became of the clicks under it */
	.corner {
		position: absolute;
		top: 1.25rem;
		right: 1.25rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.lost {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;
		line-height: 1.2;
		white-space: nowrap;
		color: var(--bad);
		animation: appear 0.35s ease-out;
	}

	.lost svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	.lost .eye {
		fill: currentColor;
		stroke: none;
	}

	@keyframes appear {
		from {
			opacity: 0;
			transform: translateY(-0.25rem) scale(0.9);
		}
	}

	.cart {
		position: relative;
		display: grid;
		place-items: center;
		width: 3.25rem;
		height: 3.25rem;
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		color: var(--text);
	}

	.cart svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.cart b {
		position: absolute;
		top: -0.5rem;
		right: -0.5rem;
		display: grid;
		place-items: center;
		min-width: 1.375rem;
		height: 1.375rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--accent);
		color: #fff;
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		animation: badge 0.4s ease-out;
	}

	@keyframes badge {
		from {
			transform: scale(1.4);
		}
	}

	/* the copy of the product picture that flies into the cart */
	.thumb.flying {
		position: absolute;
		z-index: 1;
		margin: 0;
		pointer-events: none;
		box-shadow: 0 0.5rem 1rem rgb(0 0 0 / 0.2);
	}

	.page.blank {
		visibility: hidden;
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

	.status.idle .indicator {
		border-top-color: var(--border);
		animation: none;
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
		.action output.pop,
		.cart b,
		.lost {
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

		.corner {
			top: 1rem;
			right: 1rem;
		}
	}
</style>
