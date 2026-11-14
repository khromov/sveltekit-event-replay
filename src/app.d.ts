// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	interface Window {
		/** Installed by the inline capture script, removed once the events are replayed */
		__sveltekit_event_replay?: import('./lib/types.js').CaptureApi;
	}
}

export {};
