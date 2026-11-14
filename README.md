# sveltekit-event-replay

SvelteKit renders your pages on the server, so they show up before the JavaScript that makes them interactive has loaded. A click on a `<button onclick={...}>` in that window does nothing, and the user has to click again.

`sveltekit-event-replay` adds a tiny inline script (~1 kB gzipped) to `<head>` that remembers those clicks, and replays them once SvelteKit has hydrated the page.

Try the demo at [khromov.github.io/sveltekit-event-replay](https://khromov.github.io/sveltekit-event-replay/).

## Install

```sh
npm install sveltekit-event-replay
```

Works with SvelteKit 2 and 3, and Svelte 5.

## Usage

Render `<EventReplay />` once, in your root `+layout.svelte`:

```svelte
<script>
	import { EventReplay } from 'sveltekit-event-replay';

	let { children } = $props();
</script>

<EventReplay />

{@render children()}
```

That's it. A click on any element before hydration is replayed after it, on the same element, and reaches your `onclick` handlers as well as listeners added with `addEventListener`. Clicks made while the page is hydrating wait their turn, so everything runs once and in order.

### What gets replayed

- **Repeated clicks count once.** An impatient user who clicks "Buy" three times while the page loads gets one purchase, not three. Clicks anywhere inside a `<button>` or an element with a widget role (`button`, `tab`, `menuitem`, `option`, `switch`, `checkbox`…) count as clicks on it. Turn this off with `dedupe={false}`.
- **Things the browser already handled are left alone.** Links, form controls (checkboxes, inputs, selects...), labels with a control, `<summary>`, popover and command buttons (`popovertarget`, `commandfor`) and a form's submit/reset buttons all work without JavaScript, so replaying a click on them would do it twice. They're never captured, and neither are `submit` events.
- **Clicks on elements that changed are dropped.** If a clicked element is disabled by the time it's replayed, or its text changed in the meantime, through hydration or code in `onMount` (a reordered list, a "Follow" button that turned into "Unfollow", a keyboard hint added on the client), the click may no longer mean what the user clicked, so it's skipped.
- **Opt out** of specific elements with `data-no-replay` (it applies to descendants too):

  ```svelte
  <button data-no-replay onclick={launch}>Launch</button>
  ```

- **Give feedback.** Interactive elements with a click waiting to be replayed get a `data-replay-pending` attribute:

  ```css
  [data-replay-pending] {
  	cursor: progress;
  	opacity: 0.7;
  }
  ```

- **If the page never hydrates** (`csr = false`, a chunk that failed to load), captured clicks are dropped after 10 seconds and the pending markers are removed.

## Options

| Prop       | Default                 | Description                                                                                                                                                                                                                                                                     |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`   | `['click']`             | Event types to capture. Add `'input'` and/or `'change'` to also run `oninput`/`onchange` handlers for fields edited before hydration. Fields get back the value they had when the event happened, so `'change'` also restores a `<select>` or radio group that hydration reset. |
| `dedupe`   | `true`                  | Replay at most one click per element. Other event types (keys, input...) are always replayed in full, so a shortcut pressed twice runs twice.                                                                                                                                   |
| `ignore`   | `'[data-no-replay]'`    | CSS selector for elements (and their descendants) that are never captured. `false` captures everything.                                                                                                                                                                         |
| `pending`  | `'data-replay-pending'` | Attribute set on interactive elements while their event waits to be replayed. `false` to disable. Pick a name your elements don't otherwise use: it's removed on replay.                                                                                                        |
| `timeout`  | `10000`                 | Milliseconds to wait for hydration before dropping captured events. `0` (or less) waits forever.                                                                                                                                                                                |
| `onreplay` | —                       | `(events: Event[]) => void`, called once after hydration with the events that were replayed (an empty array if there were none) — handy for analytics.                                                                                                                          |

```svelte
<EventReplay
	events={['click', 'input']}
	timeout={5000}
	onreplay={(events) => track(events.length)}
/>
```

The options except `onreplay` are read once, when the page is rendered on the server. Invalid values (a malformed `ignore` selector, say) fall back to the defaults, and at most 500 events are kept. With `'input'` and `'keydown'` both on, each keystroke counts twice.

## Content Security Policy

The inline script is identical for every app and every set of options (options travel in a `data-config` attribute), so a single hash allows it. Add `SCRIPT_HASH` to `script-src`. In SvelteKit 3:

```js
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { SCRIPT_HASH } from 'sveltekit-event-replay/script';

export default {
	plugins: [
		sveltekit({
			csp: { directives: { 'script-src': ['self', SCRIPT_HASH] } }
		})
	]
};
```

If your SvelteKit 2 app keeps its config in `svelte.config.js`, put it there instead, under `kit: { csp: { ... } }`.

Import it from `sveltekit-event-replay/script`, which Node can load (the main entry point contains a Svelte component). It works alongside SvelteKit's own nonces and hashes. If you set CSP headers yourself, wrap it in quotes: `'sha256-…'`.

## Caveats

- **Replayed events are synthetic** (`event.isTrusted === false`), which matters for browser APIs that need a user gesture. See [Replayed events and `isTrusted`](#replayed-events-and-istrusted).
- **Native behaviour isn't upgraded.** A link clicked before hydration performs a regular full-page navigation, and a form submits natively, exactly as without this package. An `onclick` on those elements doesn't run for clicks made before hydration. Use [form actions](https://svelte.dev/docs/kit/form-actions) and real links to keep them working without JavaScript.
- **Replay happens right after hydration.** Listeners added later, say after an `await` or in a `setTimeout` in `onMount`, miss it.
- **Clickable `<div>`s without a widget role** can't be told apart before hydration, so dedupe treats clicks on different parts of one as different clicks. Give them `role="button"` and `tabindex="0"` (which accessibility asks for anyway).
- **Listeners that are already running before hydration**, like an analytics script or a plain-JavaScript widget loaded with `defer`, get the real click and then its replay. Add `data-no-replay` to elements they handle, or skip replays in global listeners with [`isReplayed(event)`](#replayed-events-and-istrusted).
- **Hydration resets some fields to what the server rendered**: a `<select>` with `bind:value` or `value={...}`, a radio group with `bind:group`, and `<details bind:open>`. With `'change'` in `events`, the replay puts a select's or radio group's value back before running your handlers. A `<details>` the user opened stays closed.
- **Hydration mismatches.** If Svelte replaces an element during hydration, there's nothing to replay its click on, and it's skipped.
- **Only on the first page load, and only once per page.** Client-side navigations don't need it. If you render `<EventReplay>` twice, the first one's options win.

## Without the component

If you'd rather inject the script yourself, import `SCRIPT` from `sveltekit-event-replay/script` and add it in `src/hooks.server.js` (pasting it into `app.html` works too, but a formatter will change the script and break its CSP hash):

```js
// src/hooks.server.js
import { SCRIPT } from 'sveltekit-event-replay/script';

export const handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%event-replay%', `<script data-config='{"timeout":5000}'>${SCRIPT}</script>`)
	});
```

With `%event-replay%` in the `<head>` of `app.html`. Then call `replay()` once the app has hydrated, from `onMount` in your root layout. It holds back new clicks right away and replays a task later, once SvelteKit has started, resolving to the replayed events:

```js
import { onMount } from 'svelte';
import { replay } from 'sveltekit-event-replay';

onMount(() => {
	replay();
});
```

## Replayed events and `isTrusted`

A replayed event is dispatched from JavaScript, so its `isTrusted` is `false`. No library can change that: browsers only mark the events they create from real input as trusted.

Most code never looks at it. Svelte's `onclick` handlers, `addEventListener` listeners, state updates, `fetch`, remote functions and `goto()` all behave as they would for a real click. Two kinds of code do care:

- **Browser APIs that need a user gesture**, like `window.open` popups, clipboard writes, fullscreen, `<video>` playback with sound, `showPicker()` and `navigator.share()`. They check for user activation, which a replayed event doesn't grant. The real click made before hydration does grant it, for a few seconds, so on a page that hydrates quickly these calls often still work during the replay, and after a slow load they fail. Some of them also use the activation up, so only the first such call succeeds.
- **Code that checks `event.isTrusted` itself**, such as bot detection or some analytics scripts, ignores replayed events.

For elements whose click must come from a real gesture, add `data-no-replay` so their clicks aren't captured at all, or check `isReplayed(event)` in the handler and let the user click again:

```js
import { isReplayed } from 'sveltekit-event-replay';

async function copy(event) {
	if (isReplayed(event)) {
		hint = 'Click again to copy';
		return;
	}

	await navigator.clipboard.writeText(code);
}
```

`isReplayed` also lets analytics tell replayed clicks apart.

## Why not an existing library?

Angular's `@angular/core/primitives/event-dispatch` (JSAction) and Qwik's `qwikloader` both capture early events, and both were prototyped against this package's test suite. Neither fits: they dispatch to their own frameworks' handlers (`jsaction="…"` / `q-e:click` attributes and code-split chunks), so everything Svelte needs — re-dispatching to delegated handlers, dedupe, skipping native elements — ended up as glue code around a capture listener the size of a one-liner, while adding a large dependency and relying on internals those projects don't consider public API.

## Development

```sh
npm install
npm run dev        # the website, and the e2e fixtures at /fixtures/default
npm test           # unit tests (vitest + jsdom) and e2e tests (Playwright: Chromium, Firefox, WebKit)
npm run lint
npm run check
npm run og         # rebuilds static/og.png, the website's link preview image, from a screenshot
```

The inline script's source is [`src/script/capture.js`](src/script/capture.js). `npm run generate` minifies it into `src/lib/generated/script.js` and computes its CSP hash; a unit test fails if the generated file is out of date. The e2e tests hold back SvelteKit's client JavaScript to simulate a slow network and click around before the page hydrates. Their pages live in `src/routes/(fixtures)`, next to the [website](https://khromov.github.io/sveltekit-event-replay/) in `src/routes/(site)`. Both are prerendered with a strict CSP, so the tests also verify `SCRIPT_HASH`.

## Releasing

Releases are automated with [release-please](https://github.com/googleapis/release-please):

1. Write commit messages on `main` as [Conventional Commits](https://www.conventionalcommits.org/). `fix:`, `feat:` and `perf:` produce a release, and `feat!:` or a `BREAKING CHANGE:` footer marks a breaking one. `docs:`, `chore:`, `ci:`, `test:` and `refactor:` don't release anything on their own.
2. After every push to `main`, release-please opens or updates a release PR that bumps the version in `package.json` and adds the changes to `CHANGELOG.md`.
3. Merging the release PR tags the version, creates a GitHub release, runs the unit tests and publishes to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers) — no npm token involved, and the package gets a provenance attestation.

Until 1.0, a breaking change bumps the minor version (`0.1.0` → `0.2.0`), and features and fixes bump the patch version (`0.1.0` → `0.1.1`). To release a specific version, add a `Release-As: x.y.z` footer to a commit.

## License

MIT
