<script>
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { isReplayed } from '#lib';

	let delegated = $state(0);
	/** @type {boolean | null} whether the last click on #delegated was a replay */
	let delegated_replayed = $state(null);
	let nested = $state(0);
	let listener = $state(0);
	let ignored = $state(0);
	let checked = $state(false);
	let typed = $state('');

	/** @type {HTMLButtonElement} */
	let listener_button;

	onMount(() => {
		// a handler attached imperatively, not through Svelte's delegated `onclick`
		const increment = () => listener++;
		listener_button.addEventListener('click', increment);
		return () => listener_button.removeEventListener('click', increment);
	});
</script>

<h1>sveltekit-event-replay</h1>

<p>
	Interactions with this page before it hydrates are captured and replayed once it has. To see it
	work, throttle the network in your browser's devtools, reload, and click the buttons while the
	page is still loading.
</p>

<section>
	<h2>Replayed</h2>

	<p>
		<button
			id="delegated"
			onclick={(event) => {
				delegated++;
				delegated_replayed = isReplayed(event);
			}}
		>
			Delegated <code>onclick</code>
		</button>
		<output id="delegated-count">{delegated}</output>
		<output id="delegated-replayed">{delegated_replayed}</output>
	</p>

	<p>
		<button id="nested" onclick={() => nested++}>
			<span id="nested-icon" aria-hidden="true">★</span> Click lands on a child element
		</button>
		<output id="nested-count">{nested}</output>
	</p>

	<p>
		<button id="listener" bind:this={listener_button}>
			<code>addEventListener</code> in <code>onMount</code>
		</button>
		<output id="listener-count">{listener}</output>
	</p>

	<p>
		<label>
			<code>oninput</code> (with <code>events=&#123;['click', 'input']&#125;</code>)
			<input id="text" oninput={(event) => (typed = event.currentTarget.value)} />
		</label>
		<output id="text-value">{typed}</output>
	</p>
</section>

<section>
	<h2>Not replayed</h2>

	<p>
		<button id="ignored" data-no-replay onclick={() => ignored++}>
			<code>data-no-replay</code>
		</button>
		<output id="ignored-count">{ignored}</output>
	</p>

	<p>
		<label>
			<input id="check" type="checkbox" bind:checked /> Native checkbox (the browser already toggled it)
		</label>
		<output id="check-state">{checked}</output>
	</p>

	<p>
		<a id="other" href={resolve('/(fixtures)/fixtures/other')}
			>A link (the browser already followed it)</a
		>
	</p>
</section>
