<script>
	import { EventReplay } from '#lib';
	import '@fontsource-variable/space-grotesk';
	import '@fontsource-variable/jetbrains-mono';
	import './site.css';

	/** @type {{ children: import('svelte').Snippet }} */
	let { children } = $props();
</script>

<!-- 'change' too: hydration resets the demo's mode radios to the default, and replaying a
     change made before hydration switches the demo to the mode that was picked -->
<EventReplay events={['click', 'change']} />

{@render children()}
