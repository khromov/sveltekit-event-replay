import { JSDOM, VirtualConsole } from 'jsdom';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SCRIPT } from '../lib/generated/script.js';
import { dispatch, replay } from '../lib/replay.js';

/**
 * Renders `body` with the capture script in <head>, the way `<EventReplay>` does.
 *
 * @param {string} body
 * @param {unknown} [config]
 * @param {string} [raw] a raw (already escaped) `data-config` attribute value
 */
function setup(body, config = {}, raw) {
	const attr = raw ?? JSON.stringify(config).replaceAll('&', '&amp;').replaceAll('"', '&quot;');

	/** @type {string[]} uncaught errors thrown inside the page */
	const errors = [];
	const virtualConsole = new VirtualConsole();
	virtualConsole.on('jsdomError', (error) => errors.push(String(error.cause ?? error)));

	const dom = new JSDOM(
		`<!doctype html><html><head><script data-config="${attr}">${SCRIPT}</script></head><body>${body}</body></html>`,
		{ runScripts: 'dangerously', virtualConsole }
	);
	const { window } = dom;

	/** @param {string} selector */
	const click = (selector) =>
		/** @type {HTMLElement} */ (window.document.querySelector(selector)).click();

	const stop = () => {
		const api = /** @type {import('../lib/types.js').CaptureApi} */ (
			window.__sveltekit_event_replay
		);
		return api.stop().map(({ event, key }) => ({ type: event.type, key: key.id || key.tagName }));
	};

	const take = () => {
		const api = /** @type {import('../lib/types.js').CaptureApi} */ (
			window.__sveltekit_event_replay
		);
		return { captured: api.stop(), pending: api.pending };
	};

	return { window, document: window.document, click, stop, take, errors };
}

/** @param {number} ms */
const sleep = (ms) => new Promise((fulfil) => setTimeout(fulfil, ms));

describe('capture', () => {
	test('captures a click on a button and marks it as pending', () => {
		const { document, click, stop } = setup('<button id="a">a</button>');
		click('#a');
		expect(document.querySelector('#a')?.hasAttribute('data-replay-pending')).toBe(true);
		expect(stop()).toEqual([{ type: 'click', key: 'a' }]);
	});

	test('attributes clicks on a child element to the enclosing button', () => {
		const { click, stop } = setup(
			'<button id="a"><span id="icon">★</span></button><div role="button" id="b"><i id="i">x</i></div>'
		);
		click('#icon');
		click('#i');
		expect(stop()).toEqual([
			{ type: 'click', key: 'a' },
			{ type: 'click', key: 'b' }
		]);
	});

	test('captures clicks on non-interactive elements, keyed by the target', () => {
		const { click, stop } = setup('<div id="card"><p id="text">hi</p></div>');
		click('#text');
		expect(stop()).toEqual([{ type: 'click', key: 'text' }]);
	});

	test('dedupes repeated clicks on the same element', () => {
		const { click, stop } = setup('<button id="a"><span id="icon">★</span></button>');
		click('#a');
		click('#a');
		click('#icon');
		expect(stop()).toHaveLength(1);
	});

	test('keeps every click with dedupe: false', () => {
		const { click, stop } = setup('<button id="a">a</button>', { dedupe: false });
		click('#a');
		click('#a');
		click('#a');
		expect(stop()).toHaveLength(3);
	});

	test.each([
		['a link', '<a id="t" href="/x">x</a>'],
		['a child of a link', '<a href="/x"><span id="t">x</span></a>'],
		['an image map area', '<map name="m"><area id="t" href="/x"></map>'],
		['a checkbox', '<input id="t" type="checkbox">'],
		['a text input', '<input id="t">'],
		['a select', '<select id="t"><option>1</option></select>'],
		['a textarea', '<textarea id="t"></textarea>'],
		['a label', '<label id="t">x <input></label>'],
		['a summary', '<details><summary id="t">x</summary></details>'],
		['contenteditable', '<div id="t" contenteditable>x</div>'],
		['a submit button in a form', '<form><button id="t">x</button></form>'],
		['a reset button in a form', '<form><button id="t" type="reset">x</button></form>'],
		['a button linked to a form', '<form id="f"></form><button id="t" form="f">x</button>'],
		['an input type=submit in a form', '<form><input id="t" type="submit"></form>'],
		['a popover button', '<button id="t" popovertarget="p">x</button><div id="p" popover>p</div>'],
		['a child of a popover button', '<button popovertarget="p"><i id="t">x</i></button>'],
		['a command button', '<button id="t" commandfor="d" command="show-modal">x</button>'],
		['an element with data-no-replay', '<button id="t" data-no-replay>x</button>'],
		['a child of data-no-replay', '<div data-no-replay><button id="t">x</button></div>']
	])('ignores clicks on %s', (_, body) => {
		const { document, click, stop } = setup(body);
		click('#t');
		expect(document.querySelector('[data-replay-pending]')).toBe(null);
		expect(stop()).toEqual([]);
	});

	test.each([
		['a type=button button in a form', '<form><button id="t" type="button">x</button></form>'],
		['a submit button without a form', '<button id="t" type="submit">x</button>'],
		['contenteditable=false', '<div id="t" contenteditable="false">x</div>'],
		['an anchor without href', '<a id="t">x</a>'],
		['an input type=button', '<input id="t" type="button" value="x">'],
		['an input type=submit without a form', '<input id="t" type="submit">'],
		[
			'a button inside a summary',
			'<details><summary>s <button id="t">x</button></summary></details>'
		],
		['a custom control inside a label', '<label>x <span id="t" role="checkbox">c</span></label>']
	])('captures clicks on %s', (_, body) => {
		const { click, stop } = setup(body);
		click('#t');
		expect(stop()).toHaveLength(1);
	});

	test('supports a custom ignore selector, or none at all', () => {
		const custom = setup(
			'<button id="a" class="skip">a</button><button id="b" data-no-replay>b</button>',
			{
				ignore: '.skip'
			}
		);
		custom.click('#a');
		custom.click('#b');
		expect(custom.stop()).toEqual([{ type: 'click', key: 'b' }]);

		const none = setup('<button id="a" data-no-replay>a</button>', { ignore: false });
		none.click('#a');
		expect(none.stop()).toHaveLength(1);
	});

	test('supports a custom pending attribute, or none at all', () => {
		const custom = setup('<button id="a">a</button>', { pending: 'data-loading' });
		custom.click('#a');
		expect(custom.document.querySelector('#a')?.getAttribute('data-loading')).toBe('');

		const none = setup('<button id="a">a</button>', { pending: false });
		none.click('#a');
		expect(none.document.querySelector('#a')?.attributes).toHaveLength(1);
	});

	test('captures every event of other types, without the native-element filter', () => {
		const { window, document, click, stop } = setup('<input id="t"><button id="b">b</button>', {
			events: ['click', 'input']
		});
		const input = /** @type {HTMLInputElement} */ (document.querySelector('#t'));
		input.value = 'a';
		input.dispatchEvent(new window.InputEvent('input', { bubbles: true }));
		input.value = 'ab';
		input.dispatchEvent(new window.InputEvent('input', { bubbles: true }));
		click('#b');
		expect(stop()).toEqual([
			{ type: 'input', key: 't' },
			{ type: 'input', key: 't' },
			{ type: 'click', key: 'b' }
		]);
	});

	test('never captures submit or reset events', () => {
		const { window, document, stop } = setup('<form id="f"><button>go</button></form>', {
			events: ['click', 'submit', 'reset']
		});
		const form = /** @type {HTMLFormElement} */ (document.querySelector('#f'));
		form.addEventListener('submit', (event) => event.preventDefault());
		form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
		form.dispatchEvent(new window.Event('reset', { bubbles: true }));
		expect(stop()).toEqual([]);
	});

	test('treats clicks inside a focusable element as clicks on it', () => {
		const { document, click, stop } = setup(
			'<div id="card" tabindex="0"><h3 id="title">t</h3><p id="text">x</p></div>' +
				'<main tabindex="-1"><p id="loose">y</p></main>'
		);
		click('#title');
		click('#text');
		click('#loose');
		expect(stop()).toEqual([
			{ type: 'click', key: 'card' },
			{ type: 'click', key: 'loose' }
		]);
		expect(document.querySelector('#card')?.hasAttribute('data-replay-pending')).toBe(true);
	});

	test('only marks interactive elements as pending', () => {
		const { document, click, stop } = setup('<main><p id="text">x</p></main>');
		click('#text');
		click('main');
		expect(document.querySelector('[data-replay-pending]')).toBe(null);
		expect(stop()).toHaveLength(2);
	});

	test('stops capturing once stopped', () => {
		const { click, stop } = setup('<button id="a">a</button>');
		click('#a');
		expect(stop()).toHaveLength(1);
		click('#a');
		expect(stop()).toEqual([]);
	});

	test('gives up after the timeout and clears pending markers', async () => {
		const { document, click, stop } = setup('<button id="a">a</button>', { timeout: 20 });
		click('#a');
		expect(document.querySelector('#a')?.hasAttribute('data-replay-pending')).toBe(true);
		await new Promise((fulfil) => setTimeout(fulfil, 60));
		expect(document.querySelector('#a')?.hasAttribute('data-replay-pending')).toBe(false);
		click('#a');
		expect(stop()).toEqual([]);
	});

	test('stops capturing after the timeout without pending markers too', async () => {
		const { click, stop } = setup('<button id="a">a</button>', { pending: false, timeout: 20 });
		await sleep(60);
		click('#a');
		expect(stop()).toEqual([]);
	});

	test.each([
		['larger than setTimeout supports', 2 ** 31],
		['MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER],
		['negative (waits forever)', -1],
		['zero (waits forever)', 0],
		['Infinity, which JSON turns into null (waits forever)', Infinity]
	])('keeps capturing with a timeout that is %s', async (_, timeout) => {
		const { click, stop } = setup('<button id="a">a</button>', { timeout });
		await sleep(20);
		click('#a');
		expect(stop()).toHaveLength(1);
	});

	test('falls back to the default ignore selector when it is invalid', () => {
		const { click, stop, errors } = setup(
			'<button id="a">a</button><button id="b" data-no-replay>b</button>',
			{ ignore: 'button[' }
		);
		click('#a');
		click('#b');
		expect(errors).toEqual([]);
		expect(stop()).toEqual([{ type: 'click', key: 'a' }]);
	});

	test('falls back to the default pending attribute when the name is invalid', () => {
		const { document, click, stop, errors } = setup('<button id="a">a</button>', {
			pending: 'data replay'
		});
		click('#a');
		expect(errors).toEqual([]);
		expect(document.querySelector('#a')?.hasAttribute('data-replay-pending')).toBe(true);
		expect(stop()).toHaveLength(1);
	});

	test.each([
		['events: null', { events: null }, undefined],
		['events: "click"', { events: 'click' }, undefined],
		['a null config', undefined, 'null'],
		['a numeric config', undefined, '42']
	])('falls back to the defaults for %s', (_, config, raw) => {
		const { click, stop, errors } = setup('<button id="a">a</button>', config, raw);
		click('#a');
		expect(errors).toEqual([]);
		expect(stop()).toHaveLength(1);
	});

	test('caps the queue at 100 events', () => {
		const { click, stop } = setup('<button id="a">a</button>', { dedupe: false });
		for (let i = 0; i < 1000; i++) click('#a');
		expect(stop()).toHaveLength(100);
	});

	test('falls back to the defaults when the config is malformed', () => {
		const dom = new JSDOM(
			`<!doctype html><head><script data-config="{oops">${SCRIPT}</script></head><body><button id="a">a</button></body>`,
			{ runScripts: 'dangerously' }
		);
		/** @type {HTMLElement} */ (dom.window.document.querySelector('#a')).click();
		expect(dom.window.__sveltekit_event_replay?.stop()).toHaveLength(1);
	});

	test('only installs itself once', () => {
		const { window } = setup('<button id="a">a</button>');
		const api = window.__sveltekit_event_replay;
		const script = window.document.createElement('script');
		script.textContent = SCRIPT;
		window.document.head.append(script);
		expect(window.__sveltekit_event_replay).toBe(api);
	});
});

describe('dispatch', () => {
	test('re-dispatches captured events on their targets and clears pending markers', () => {
		const { window, document, click } = setup('<button id="a"><span id="icon">★</span></button>');
		click('#icon');

		const api = /** @type {import('../lib/types.js').CaptureApi} */ (
			window.__sveltekit_event_replay
		);
		const taken = { captured: api.stop(), pending: api.pending };

		/** @type {Event[]} */
		const received = [];
		document.querySelector('#a')?.addEventListener('click', (event) => received.push(event));

		const dispatched = dispatch(taken);

		expect(received).toEqual(dispatched);
		expect(received).toHaveLength(1);
		expect(received[0]).toBeInstanceOf(window.MouseEvent);
		expect(received[0].target).toBe(document.querySelector('#icon'));
		expect(received[0].bubbles).toBe(true);
		expect(document.querySelector('[data-replay-pending]')).toBe(null);
	});

	test('skips events whose target was removed from the document', () => {
		const { window, document, click } = setup('<button id="a">a</button>');
		click('#a');
		const api = /** @type {import('../lib/types.js').CaptureApi} */ (
			window.__sveltekit_event_replay
		);
		const taken = { captured: api.stop(), pending: api.pending };
		document.querySelector('#a')?.remove();
		expect(dispatch(taken)).toEqual([]);
	});

	test('does nothing when there is nothing to replay', () => {
		expect(dispatch(null)).toEqual([]);
	});

	test('keeps going when an event cannot be copied, and reports the error', () => {
		const { window, document, click, take } = setup(
			'<button id="a">a</button><button id="b">b</button><button id="c">c</button>'
		);

		// stands in for e.g. TextEvent ('textInput'), whose constructor is illegal
		class IllegalEvent extends window.Event {
			/** @param {string} type @param {EventInit} init */
			constructor(type, init) {
				if (init instanceof window.Event) throw new window.TypeError('Illegal constructor');
				super(type, init);
			}
		}

		click('#a');
		document.querySelector('#b')?.dispatchEvent(new IllegalEvent('click', { bubbles: true }));
		click('#c');

		let c = 0;
		document.querySelector('#c')?.addEventListener('click', () => c++);

		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(dispatch(take())).toHaveLength(2);
		expect(error).toHaveBeenCalledOnce();
		error.mockRestore();

		expect(c).toBe(1);
		expect(document.querySelector('[data-replay-pending]')).toBe(null);
	});

	test('skips elements that are disabled by the time they are replayed', () => {
		const { document, click, take } = setup(
			'<button id="buy">buy</button><button id="cancel">cancel</button>' +
				'<fieldset id="set"><button id="inner">inner</button></fieldset>'
		);
		click('#buy');
		click('#cancel');
		click('#inner');

		/** @type {string[]} */
		const log = [];
		const buy = /** @type {HTMLButtonElement} */ (document.querySelector('#buy'));
		const cancel = /** @type {HTMLButtonElement} */ (document.querySelector('#cancel'));
		buy.addEventListener('click', () => {
			log.push('buy');
			cancel.disabled = true; // e.g. `disabled={busy}`
		});
		cancel.addEventListener('click', () => log.push('cancel'));
		document.querySelector('#inner')?.addEventListener('click', () => log.push('inner'));
		/** @type {HTMLFieldSetElement} */ (document.querySelector('#set')).disabled = true;

		expect(dispatch(take())).toHaveLength(1);
		expect(log).toEqual(['buy']);
		expect(document.querySelector('[data-replay-pending]')).toBe(null);
	});

	test('skips elements whose text changed during hydration', () => {
		const { document, click, take } = setup(
			'<ul><li><button id="first">one</button></li><li><button id="second">two</button></li></ul>'
		);
		click('#first');
		click('#second');

		// hydration reused the first node for a different item
		/** @type {HTMLElement} */ (document.querySelector('#first')).textContent = 'three';

		/** @type {string[]} */
		const log = [];
		for (const button of document.querySelectorAll('button')) {
			button.addEventListener('click', () => log.push(/** @type {string} */ (button.textContent)));
		}

		expect(dispatch(take())).toHaveLength(1);
		expect(log).toEqual(['two']);
		expect(document.querySelector('[data-replay-pending]')).toBe(null);
	});

	test('keeps going when a handler throws', () => {
		const { document, click, take, errors } = setup(
			'<button id="a">a</button><button id="b">b</button>'
		);
		click('#a');
		click('#b');
		let b = 0;
		document.querySelector('#a')?.addEventListener('click', () => {
			throw new Error('handler failed');
		});
		document.querySelector('#b')?.addEventListener('click', () => b++);
		expect(dispatch(take())).toHaveLength(2);
		expect(b).toBe(1);
		expect(errors.join()).toContain('handler failed');
	});
});

describe('replay', () => {
	afterEach(() => {
		// @ts-expect-error -- set by the tests below
		delete globalThis.window;
	});

	test('holds events back until the replay, so they run once and in order', async () => {
		const { window, document, click } = setup(
			'<button id="a">a</button><button id="b">b</button><input id="check" type="checkbox">'
		);
		// @ts-expect-error -- replay() reads the global window
		globalThis.window = window;

		click('#a'); // before hydration: captured

		// hydration attaches the handlers, then replay() is called
		/** @type {string[]} */
		const log = [];
		for (const id of ['a', 'b', 'check']) {
			document.querySelector(`#${id}`)?.addEventListener('click', () => log.push(id));
		}
		const replayed = replay();

		// after hydration, before the replay task (e.g. while hydration blocked the main thread)
		click('#b'); // held back, so it can't overtake the click on #a
		click('#a'); // a repeat of a captured click: dropped, like before hydration
		click('#check'); // native: never captured, so the app gets it right away
		expect(log).toEqual(['check']);

		expect(await replayed).toHaveLength(2);
		expect(log).toEqual(['check', 'a', 'b']);
		expect('__sveltekit_event_replay' in window).toBe(false);

		click('#a'); // after the replay: the app handles it, nothing is captured
		expect(log).toEqual(['check', 'a', 'b', 'a']);
	});

	test('resolves to an empty array when the script never ran', async () => {
		const { window } = new JSDOM('<!doctype html><body></body>');
		// @ts-expect-error -- replay() reads the global window
		globalThis.window = window;
		expect(await replay()).toEqual([]);
	});

	test('is not fooled by an element with id="__sveltekit_event_replay"', async () => {
		const { window } = new JSDOM(
			'<!doctype html><body><h2 id="__sveltekit_event_replay">x</h2></body>'
		);
		// @ts-expect-error -- replay() reads the global window
		globalThis.window = window;
		expect(await replay()).toEqual([]);
	});
});
