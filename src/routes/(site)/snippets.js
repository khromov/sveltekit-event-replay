// The code samples shown on the website. They live in a .js file because a Svelte component can't
// contain a closing script tag inside a string

export const install = 'npm install sveltekit-event-replay';

/** Split around the one line that matters, so the page can highlight it */
export const usage = {
	before: `<script>
	import { EventReplay } from 'sveltekit-event-replay';

	let { children } = $props();
</script>

`,
	line: '<EventReplay />',
	after: `

{@render children()}`
};

export const csp = `import { SCRIPT_HASH } from 'sveltekit-event-replay';

sveltekit({
	csp: {
		directives: { 'script-src': ['self', SCRIPT_HASH] }
	}
});`;
