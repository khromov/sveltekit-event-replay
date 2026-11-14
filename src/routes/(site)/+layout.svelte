<script>
	import { EventReplay } from '#lib';
	import './site.css';

	/** @type {{ children: import('svelte').Snippet }} */
	let { children } = $props();
</script>

<EventReplay />

{@render children()}
