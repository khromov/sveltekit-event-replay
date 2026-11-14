# sveltekit-event-replay

SvelteKit renders your pages on the server, so they show up before the JavaScript that makes them interactive has loaded. A click on a `<button onclick={...}>` in that window does nothing, and the user has to click again.

`sveltekit-event-replay` adds a tiny inline script (~660 bytes gzipped) to `<head>` that remembers those clicks, and replays them once SvelteKit has hydrated the page.

Try the demo at [khromov.github.io/sveltekit-event-replay](https://khromov.github.io/sveltekit-event-replay/).

## Install

```sh
npm install sveltekit-event-replay
```

Requires SvelteKit 3 and Svelte 5.

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

That's it. A click on any element before hydration is replayed after it, on the same element, and reaches your `onclick` handlers as well as listeners added with `addEventListener`.

### What gets replayed

- **Repeated clicks count once.** An impatient user who clicks "Buy" three times while the page loads gets one purchase, not three. Turn this off with `dedupe={false}`.
- **Things the browser already handled are left alone.** Links, form controls (checkboxes, inputs, selects...), labels, `<summary>` and a form's submit/reset buttons all work without JavaScript, so replaying a click on them would do it twice. They're never captured.
- **Opt out** of specific elements with `data-no-replay` (it applies to descendants too):

  ```svelte
  <button data-no-replay onclick={launch}>Launch</button>
  ```

- **Give feedback.** Elements with a click waiting to be replayed get a `data-replay-pending` attribute:

  ```css
  [data-replay-pending] {
  	cursor: progress;
  	opacity: 0.7;
  }
  ```

- **If the page never hydrates** (`csr = false`, a chunk that failed to load), captured clicks are dropped after 10 seconds and the pending markers are removed.

## Options

| Prop       | Default                 | Description                                                                                                                                                                                             |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events`   | `['click']`             | Event types to capture. Add `'input'` and/or `'change'` to also run `oninput`/`onchange` handlers for fields edited before hydration (the browser already updated their values; `bind:` needs no help). |
| `dedupe`   | `true`                  | Replay at most one event per element and event type.                                                                                                                                                    |
| `ignore`   | `'[data-no-replay]'`    | CSS selector for elements (and their descendants) that are never captured. `false` captures everything.                                                                                                 |
| `pending`  | `'data-replay-pending'` | Attribute set on elements while their event waits to be replayed. `false` to disable. Pick a name your elements don't otherwise use: it's removed on replay.                                            |
| `timeout`  | `10000`                 | Milliseconds to wait for hydration before dropping captured events. `0` (or less) waits forever.                                                                                                        |
| `onreplay` | —                       | `(events: Event[]) => void`, called after hydration with the events that were replayed (an empty array if there were none) — handy for analytics.                                                       |

```svelte
<EventReplay
	events={['click', 'input']}
	timeout={5000}
	onreplay={(events) => track(events.length)}
/>
```

The options except `onreplay` are read once, when the page is rendered on the server. Invalid values (a malformed `ignore` selector, say) fall back to the defaults, and at most 100 events are kept.

## Content Security Policy

The inline script is identical for every app and every set of options (options travel in a `data-config` attribute), so a single hash allows it. Add `SCRIPT_HASH` to `script-src`:

```js
// vite.config.js (or svelte.config.js)
import { SCRIPT_HASH } from 'sveltekit-event-replay';

sveltekit({
	csp: {
		directives: { 'script-src': ['self', SCRIPT_HASH] }
	}
});
```

This works alongside SvelteKit's own nonces/hashes. If you set CSP headers yourself, wrap it in quotes: `'sha256-…'`.

## Caveats

- **Replayed events are synthetic.** They have `event.isTrusted === false` and don't count as user activation, so APIs that require a real gesture (`window.open` popups, clipboard writes, fullscreen, `<video>` playback with sound) may refuse them.
- **Native behaviour isn't upgraded.** A link clicked before hydration performs a regular full-page navigation, and a form submits natively — exactly like without this package. Use [form actions](https://svelte.dev/docs/kit/form-actions) and real links to keep those working without JavaScript.
- **Hydration mismatches.** If Svelte replaces an element during hydration, there's nothing to replay its click on, and it's skipped.
- **Only on the first page load.** Client-side navigations don't need it and don't use it.

## Without the component

`SCRIPT` is exported if you'd rather put the script into `app.html` yourself (wrap it in `<script>…</script>` in `<head>`, optionally with a `data-config='{"timeout":5000}'` attribute). Then call `replay()` once the app has hydrated, e.g. from `afterNavigate` in your root layout. It stops capturing right away and replays a task later, once SvelteKit's router has started, resolving to the replayed events:

```js
import { afterNavigate } from '$app/navigation';
import { replay } from 'sveltekit-event-replay';

afterNavigate(({ type }) => {
	if (type === 'enter') replay();
});
```

## Why not an existing library?

Angular's `@angular/core/primitives/event-dispatch` (JSAction) and Qwik's `qwikloader` both capture early events, and both were prototyped against this package's test suite. Neither fits: they dispatch to their own frameworks' handlers (`jsaction="…"` / `q-e:click` attributes and code-split chunks), so everything Svelte needs — re-dispatching to delegated handlers, dedupe, skipping native elements — ended up as glue code around a capture listener the size of a one-liner, while adding a large dependency and relying on internals those projects don't consider public API.

## Development

```sh
npm install
npm run dev        # the website, and the e2e fixtures at /fixtures/default
npm test           # unit tests (vitest + jsdom) and e2e tests (Playwright: Chromium, Firefox, WebKit)
npm run lint
npm run check
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
