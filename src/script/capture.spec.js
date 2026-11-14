import { JSDOM } from 'jsdom';
import { describe, expect, test } from 'vitest';
import { SCRIPT } from '../lib/generated/script.js';
import { dispatch } from '../lib/replay.js';

/**
 * Renders `body` with the capture script in <head>, the way `<EventReplay>` does.
 *
 * @param {string} body
 * @param {Record<string, unknown>} [config]
 */
function setup(body, config = {}) {
	const attr = JSON.stringify(config).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
	const dom = new JSDOM(
		`<!doctype html><html><head><script data-config="${attr}">${SCRIPT}</script></head><body>${body}</body></html>`,
		{ runScripts: 'dangerously' }
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

	return { window, document: window.document, click, stop };
}

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
		['an anchor without href', '<a id="t">x</a>']
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
		const custom = setup('<button id="a">a</button>', { pending: 'aria-busy' });
		custom.click('#a');
		expect(custom.document.querySelector('#a')?.getAttribute('aria-busy')).toBe('');

		const none = setup('<button id="a">a</button>', { pending: false });
		none.click('#a');
		expect(none.document.querySelector('#a')?.attributes).toHaveLength(1);
	});

	test('captures other event types, without the native-element filter', () => {
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
			{ type: 'click', key: 'b' }
		]);
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
});
