<script>
	import { EventReplay } from '#lib';
	import '@fontsource-variable/space-grotesk';
	import '@fontsource-variable/jetbrains-mono';
	import './site.css';

	/** @type {{ children: import('svelte').Snippet }} */
	let { children } = $props();
</script>

<EventReplay />

{@render children()}
