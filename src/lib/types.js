/**
 * Options understood by the inline capture script. They are serialized into the script's
 * `data-config` attribute on the server.
 *
 * @typedef {object} CaptureConfig
 * @property {string[]} events
 * Event types to capture before hydration. Defaults to `['click']`. The native-element filter
 * (links, form controls, labels...) only applies to `click`, and `submit`/`reset` are never
 * captured. `input` and `change` are safe to add: the browser already updated the value, and
 * replaying them runs your `oninput`/`onchange` handlers.
 * @property {boolean} dedupe
 * Replay at most one click per element. A button clicked three times while the page was loading is
 * replayed once. Other event types are always replayed in full. Defaults to `true`.
 * @property {string | false} ignore
 * CSS selector for elements whose events are never captured (matched against the target and its
 * ancestors). Defaults to `'[data-no-replay]'`.
 * @property {string | false} pending
 * Attribute set on an interactive element while it has an event waiting to be replayed — use it to
 * give feedback, e.g. `[data-replay-pending] { cursor: progress }`. Defaults to
 * `'data-replay-pending'`.
 * @property {number} timeout
 * Milliseconds after which, if the app still hasn't hydrated, captured events are dropped and
 * capturing stops. `0` waits forever. Defaults to `10000`.
 */

/**
 * @typedef {object} CapturedEvent
 * @property {Event} event The original event, as the browser dispatched it before hydration
 * @property {Element} key The element the event is attributed to (used for dedupe and `pending`)
 * @property {string | null} text The key's text when it was captured, compared before replaying
 */

/**
 * The global installed by the inline script, consumed by `<EventReplay>` after hydration.
 *
 * @typedef {object} CaptureApi
 * @property {() => CapturedEvent[]} stop Stop capturing and hand over the captured events
 * @property {() => void} hold Keep capturing, but hold captured events back from the app
 * @property {string | false} pending The pending attribute name the script used
 */

export {};
