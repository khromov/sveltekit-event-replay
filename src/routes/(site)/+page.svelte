<script>
	import Demo from './Demo.svelte';
	import { csp, install, usage } from './snippets.js';

	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(install);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:head>
	<title>sveltekit-event-replay</title>
	<meta
		name="description"
		content="Capture clicks that happen before SvelteKit hydrates the page, and replay them once it has."
	/>
</svelte:head>

<header>
	<span>sveltekit-event-replay</span>
	<a href="https://github.com/khromov/sveltekit-event-replay">GitHub</a>
</header>

<main>
	<section class="hero">
		<h1>Replay clicks made before hydration</h1>

		<p class="lead">
			SvelteKit shows server-rendered HTML before its JavaScript loads. This inline script, 660 B
			gzipped, captures clicks made in that gap and replays them once the page hydrates.
		</p>

		<p class="install">
			<code>{install}</code>
			<!-- writing to the clipboard takes a real click, which a replayed one isn't -->
			<button type="button" data-no-replay aria-label={copied ? 'Copied' : 'Copy'} onclick={copy}>
				<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
					{#if copied}
						<path d="m3.5 8.5 3 3 6-7" />
					{:else}
						<rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
						<path
							d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"
						/>
					{/if}
				</svg>
			</button>
		</p>
	</section>

	<section class="try">
		<p>Hit Reload and click the buttons while the page loads. Then switch modes.</p>

		<Demo />

		<p class="note">Gift wrap is a native checkbox. The browser toggles it in both modes.</p>
	</section>

	<section>
		<h2>Usage</h2>

		<p>
			Render <code>&lt;EventReplay /&gt;</code> once in your root layout. It runs on SvelteKit 3 with
			Svelte 5.
		</p>

		<pre><code>{usage.before}<mark>{usage.line}</mark>{usage.after}</code></pre>
	</section>

	<section>
		<h2>Behavior</h2>

		<ul>
			<li>Repeated clicks on one element replay once.</li>
			<li>
				Links, form controls, labels, <code>&lt;summary&gt;</code> and submit buttons stay with the browser.
			</li>
			<li><code>data-no-replay</code> skips an element and everything inside it.</li>
			<li>
				Elements waiting for a replay carry <code>data-replay-pending</code>, so you can style them.
			</li>
			<li>Captured clicks expire after 10 seconds if hydration stalls.</li>
			<li>
				Replayed clicks reach <code>onclick</code> handlers and <code>addEventListener</code> listeners.
			</li>
		</ul>
	</section>

	<section>
		<h2>Options</h2>

		<table>
			<thead>
				<tr>
					<th scope="col">Prop</th>
					<th scope="col">Default</th>
					<th scope="col">Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<th scope="row"><code>events</code></th>
					<td><code>['click']</code></td>
					<td>
						Event types to capture. Add <code>'input'</code> or <code>'change'</code> to run those handlers
						for fields edited before hydration.
					</td>
				</tr>
				<tr>
					<th scope="row"><code>dedupe</code></th>
					<td><code>true</code></td>
					<td>Replay at most one event per element and event type.</td>
				</tr>
				<tr>
					<th scope="row"><code>ignore</code></th>
					<td><code>'[data-no-replay]'</code></td>
					<td>
						CSS selector for elements to skip, descendants included. <code>false</code> captures everything.
					</td>
				</tr>
				<tr>
					<th scope="row"><code>pending</code></th>
					<td><code>'data-replay-pending'</code></td>
					<td>
						Attribute set on elements while their event waits. <code>false</code> turns it off.
					</td>
				</tr>
				<tr>
					<th scope="row"><code>timeout</code></th>
					<td><code>10000</code></td>
					<td>
						Milliseconds to wait for hydration before dropping captured events. <code>0</code> waits forever.
					</td>
				</tr>
				<tr>
					<th scope="row"><code>onreplay</code></th>
					<td></td>
					<td>
						<code>(events: Event[]) =&gt; void</code>, called after hydration with the replayed
						events.
					</td>
				</tr>
			</tbody>
		</table>
	</section>

	<section>
		<h2>Content Security Policy</h2>

		<p>The script is identical in every app, so one hash allows it.</p>

		<pre><code>{csp}</code></pre>
	</section>

	<p class="more">
		Caveats and manual setup are in the
		<a href="https://github.com/khromov/sveltekit-event-replay#readme">README</a>.
	</p>
</main>

<style>
	header,
	main {
		max-width: 42rem;
		margin: 0 auto;
		padding: 0 1rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding-top: 1.25rem;
		font-size: 0.875rem;
	}

	header span {
		font-family: var(--mono);
		font-size: 0.8125rem;
	}

	header a {
		color: var(--muted);
		text-decoration: none;
	}

	header a:hover {
		color: var(--text);
	}

	main {
		padding-bottom: 6rem;
	}

	section {
		margin-top: 4rem;
	}

	.hero {
		margin-top: 5rem;
		text-align: center;
	}

	h1 {
		margin: 0;
		font-size: clamp(2rem, 1.2rem + 4vw, 3.25rem);
		font-weight: 600;
		line-height: 1.08;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}

	.lead {
		max-width: 34rem;
		margin: 1.25rem auto 0;
		font-size: 1.0625rem;
		color: var(--muted);
		text-wrap: pretty;
	}

	.install {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		max-width: 100%;
		margin: 2rem 0 0;
		padding: 0.25rem 0.25rem 0.25rem 1rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--surface);
		font-size: clamp(0.8125rem, 3.6vw, 1rem);
	}

	.install code {
		overflow-x: auto;
		white-space: nowrap;
	}

	.install code::before {
		content: '$ ';
		color: var(--muted);
	}

	.install button {
		display: grid;
		flex: none;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}

	.install button:hover {
		background: var(--subtle);
		color: var(--text);
	}

	.install svg {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.try {
		margin-top: 3.5rem;
	}

	.try > p {
		margin: 0 0 1rem;
		text-align: center;
	}

	.try > .note {
		margin: 0.875rem 0 0;
		font-size: 0.875rem;
		color: var(--muted);
	}

	h2 {
		margin: 0 0 0.75rem;
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: -0.015em;
	}

	section > p {
		margin: 0 0 1rem;
	}

	:not(pre) > code {
		padding: 0.125em 0.3em;
		border-radius: 0.3em;
		background: var(--subtle);
	}

	.install code {
		padding: 0;
		background: none;
	}

	pre {
		margin: 0;
		padding: 1rem 1.125rem;
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background: var(--surface);
		line-height: 1.6;
		tab-size: 2;
	}

	pre code {
		font-size: 1em;
	}

	mark {
		margin: 0 -0.3em;
		padding: 0.15em 0.3em;
		border-radius: 0.3em;
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		color: inherit;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		padding: 0.625rem 0;
		border-top: 1px solid var(--border);
	}

	li:last-child {
		border-bottom: 1px solid var(--border);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}

	th,
	td {
		padding: 0.625rem 1rem 0.625rem 0;
		border-top: 1px solid var(--border);
		font-weight: 400;
		text-align: left;
		vertical-align: top;
	}

	thead th {
		border-top: 0;
		font-size: 0.8125rem;
		color: var(--muted);
	}

	tbody tr:last-child > * {
		border-bottom: 1px solid var(--border);
	}

	tbody th,
	tbody td:nth-child(2) {
		white-space: nowrap;
	}

	tr > :last-child {
		padding-right: 0;
	}

	.more {
		margin: 4rem 0 0;
		color: var(--muted);
	}

	@media (max-width: 36rem) {
		.hero {
			margin-top: 3.5rem;
		}

		section {
			margin-top: 3rem;
		}

		/* each option becomes a block: name and default on one line, the description below */
		thead {
			display: none;
		}

		tbody tr {
			display: flex;
			flex-wrap: wrap;
			gap: 0.25rem 0.75rem;
			padding: 0.625rem 0;
			border-top: 1px solid var(--border);
		}

		tbody tr:last-child {
			border-bottom: 1px solid var(--border);
		}

		tbody tr > * {
			padding: 0;
			border: 0 !important;
		}

		tbody td:last-child {
			flex-basis: 100%;
		}
	}
</style>
