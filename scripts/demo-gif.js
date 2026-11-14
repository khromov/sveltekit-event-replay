// Records the website's demo playing itself into .github/demo.gif, the animation at the top of the
// README. It builds the site, serves the build on a free port, and records the pretend mouse of
// src/routes/(site)/tour.js in Chromium as it plays the demo With EventReplay, then in Standard
// SvelteKit.
//
// The pretend mouse keeps switching between the two modes. The GIF is its second run With
// EventReplay and the Standard SvelteKit run after it, so it loops without a jump: it ends the way
// it starts, with the mouse resting by the status bar and the Standard SvelteKit result on screen.
//
// Chrome's screencast stamps every frame with the time it was drawn, so the GIF plays at real
// speed. gifenc encodes it with one palette for all frames, and every frame after the first only
// holds the rectangle that changed.
import { chromium } from '@playwright/test';
import gifenc from 'gifenc';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { createBuilder, preview } from 'vite';

const { GIFEncoder, quantize } = gifenc;

const OUTPUT = '.github/demo.gif';

/** Wide enough for the website's column at its widest, which makes the demo 640 CSS pixels wide */
const VIEWPORT_WIDTH = 672;

/** Makes the GIF 672 × 1.25 = 840 pixels wide */
const SCALE = 1.25;

/** Room around the demo in CSS pixels, enough for the mock browser's shadow */
const MARGIN = 16;

/** The time between frames in hundredths of a second, the unit GIF counts in: 33 frames a second */
const FRAME_TIME = 3;

/** How many of the GIF's colors are the most common ones exactly: backgrounds, borders and text */
const EXACT_COLORS = 64;

/** The palette index that lets the previous frame show through. The other 255 are colors */
const TRANSPARENT = 255;

/** @typedef {{ type: 'move' | 'mode', time: number }} Mark */
/** @typedef {{ data: string, time: number }} Frame */
/** @typedef {{ index: Uint8Array, x: number, y: number, width: number, height: number }} Rect */

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

// like `vite build`: every environment, including the server build that prerendering renders with.
// (Vite's `build()` only builds the client, which leaves the prerendered HTML out of date)
const builder = await createBuilder({ logLevel: 'warn' });
await builder.buildApp();

// port 0 picks a free one
const server = await preview({ preview: { port: 0 }, logLevel: 'warn' });

/** @type {Frame[]} */
const frames = [];

// when the GIF starts and ends, in milliseconds since the epoch like the frames' times
/** @type {number} */
let start;
/** @type {number} */
let end;

try {
	// the screencast sends frames in CSS pixels unless the browser itself has the scale factor,
	// rather than only the page
	const browser = await chromium.launch({ args: [`--force-device-scale-factor=${SCALE}`] });

	try {
		const page = await browser.newPage({
			viewport: { width: VIEWPORT_WIDTH, height: 800 },
			deviceScaleFactor: SCALE,
			colorScheme: 'light',
			// the demo only plays itself for visitors who don't mind motion
			reducedMotion: 'no-preference'
		});

		// when the pretend mouse sets off somewhere, and when it switches modes
		/** @type {Mark[]} */
		const marks = [];
		await page.exposeFunction('mark', (/** @type {Mark} */ mark) => marks.push(mark));
		await page.addInitScript(() => {
			// added by exposeFunction above
			const { mark } = /** @type {{ mark: (mark: Mark) => void }} */ (
				/** @type {unknown} */ (window)
			);

			new MutationObserver((records) => {
				if (records.some(({ target }) => /** @type {Element} */ (target).matches('.mouse'))) {
					mark({ type: 'move', time: Date.now() });
				}
			}).observe(document, { subtree: true, attributes: true, attributeFilter: ['style'] });

			addEventListener(
				'change',
				({ target }) => {
					if (/** @type {HTMLInputElement} */ (target).name === 'mode') {
						mark({ type: 'mode', time: Date.now() });
					}
				},
				true
			);
		});

		/**
		 * Waits until the pretend mouse has switched modes `count` times, and returns when it set
		 * off towards the mode it switched to last
		 * @param {number} count
		 */
		const switched = async (count) => {
			const deadline = Date.now() + 60_000;

			while (true) {
				const switches = marks.filter((mark) => mark.type === 'mode');

				if (switches.length >= count) {
					const moves = marks.filter(
						(mark) => mark.type === 'move' && mark.time <= switches[count - 1].time
					);
					return moves[moves.length - 1].time;
				}

				if (Date.now() > deadline) throw new Error('The demo stopped playing itself');
				await new Promise((fulfil) => setTimeout(fulfil, 50));
			}
		};

		const [url] = server.resolvedUrls?.local ?? [];
		await page.goto(url);

		// fit the viewport around the demo and scroll to it, which starts the pretend mouse. A
		// height divisible by 4 makes a whole number of pixels at 1.25 pixels per CSS pixel
		const box = await page.locator('.demo').evaluate((element) => {
			const rect = element.getBoundingClientRect();
			return { top: rect.top + scrollY, height: rect.height };
		});
		const viewport = {
			width: VIEWPORT_WIDTH,
			height: Math.ceil((box.height + 2 * MARGIN) / 4) * 4
		};
		await page.setViewportSize(viewport);
		await page.evaluate((top) => scrollTo(0, top), box.top - MARGIN);
		await page.locator('.demo .mouse.touring').waitFor();

		// the pretend mouse loads the mock page With EventReplay, then switches to Standard
		// SvelteKit, back to With EventReplay and so on. Recording starts at the first switch
		await switched(1);

		const cdp = await page.context().newCDPSession(page);
		cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
			frames.push({ data, time: (metadata.timestamp ?? Date.now() / 1000) * 1000 });
			cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
		});
		await cdp.send('Page.startScreencast', {
			format: 'png',
			maxWidth: viewport.width * SCALE,
			maxHeight: viewport.height * SCALE
		});

		// the GIF starts as the mouse sets off to switch back to With EventReplay, and ends as it sets
		// off to do that again, two switches later
		start = await switched(2);
		end = await switched(4);

		await cdp.send('Page.stopScreencast');
	} finally {
		await browser.close();
	}
} finally {
	await server.close();
}

// what the demo looked like every FRAME_TIME, leaving out repeats. Times from here on are in
// hundredths of a second from the start of the GIF
const duration = Math.round((end - start) / 10 / FRAME_TIME) * FRAME_TIME;

/** @type {Array<{ frame: Frame, time: number }>} */
const shown = [];

if (frames.length === 0 || frames[0].time > start) {
	throw new Error('The recording started too late');
}

for (let time = 0, i = 0; time < duration; time += FRAME_TIME) {
	while (i + 1 < frames.length && frames[i + 1].time <= start + time * 10) i++;
	if (shown.at(-1)?.frame !== frames[i]) shown.push({ frame: frames[i], time });
}

const { width, height } = PNG.sync.read(Buffer.from(shown[0].frame.data, 'base64'));
if (width !== VIEWPORT_WIDTH * SCALE) {
	throw new Error(`The screencast is ${width} pixels wide, not ${VIEWPORT_WIDTH * SCALE}`);
}

const palette = pick_palette(shown.map(({ frame }) => frame));
const encoder = GIFEncoder();

/** What the GIF shows so far, as indexes into the palette */
const canvas = new Uint8Array(width * height);

/** The palette index of every color seen so far, or -1 */
const nearest = new Int16Array(1 << 24).fill(-1);

/**
 * The frame waiting to be written, which shows until the next one
 * @type {(Rect & { time: number }) | undefined}
 */
let pending;
let count = 0;

for (const { frame, time } of shown) {
	const index = palettize(decode(frame), palette, nearest);

	if (!pending) {
		canvas.set(index);
		pending = { index, x: 0, y: 0, width, height, time };
		continue;
	}

	const changed = draw(index, canvas, width, height);
	if (!changed) continue;

	write(pending, time);
	pending = { ...changed, time };
}

if (pending) write(pending, duration);
encoder.finish();

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, encoder.bytes());

console.log(
	`Wrote ${OUTPUT}: ${width}×${height}, ${(duration / 100).toFixed(1)} s, ${count} frames, ` +
		`${(statSync(OUTPUT).size / 1024 / 1024).toFixed(2)} MB`
);

/**
 * @param {Frame} frame
 * @returns {Uint8Array} its pixels, as RGBA
 */
function decode(frame) {
	const png = PNG.sync.read(Buffer.from(frame.data, 'base64'));
	if (png.width !== width || png.height !== height) throw new Error('The frame size changed');
	return png.data;
}

/**
 * Picks the GIF's 255 colors: the most common ones exactly, and the rest quantized. A pixel counts
 * once for every frame it changes in, so that brief moments, like the product flying into the
 * cart, get colors of their own
 * @param {Frame[]} frames
 * @returns {number[][]}
 */
function pick_palette(frames) {
	const counts = new Uint32Array(1 << 24);

	/** @type {Uint8Array | undefined} */
	let previous;

	for (const frame of frames) {
		const data = decode(frame);

		for (let i = 0; i < data.length; i += 4) {
			if (
				previous &&
				data[i] === previous[i] &&
				data[i + 1] === previous[i + 1] &&
				data[i + 2] === previous[i + 2]
			) {
				continue;
			}

			counts[(data[i] << 16) | (data[i + 1] << 8) | data[i + 2]]++;
		}

		previous = data;
	}

	/** @type {number[]} */
	const colors = [];
	counts.forEach((count, color) => {
		if (count > 0) colors.push(color);
	});
	colors.sort((a, b) => counts[b] - counts[a]);

	/** @param {number} color */
	const rgb = (color) => [color >> 16, (color >> 8) & 255, color & 255];

	const exact = colors.slice(0, EXACT_COLORS);
	const rest = colors.slice(EXACT_COLORS);
	if (rest.length === 0) return exact.map(rgb);

	// the rest, each repeated the square root of its count, so that rare colors aren't all merged
	const repeats = rest.map((color) => Math.ceil(Math.sqrt(counts[color])));
	const pixels = new Uint8Array(repeats.reduce((sum, n) => sum + n, 0) * 4);
	let p = 0;

	rest.forEach((color, i) => {
		const [r, g, b] = rgb(color);
		for (let n = 0; n < repeats[i]; n++) {
			pixels.set([r, g, b, 255], p);
			p += 4;
		}
	});

	return [...exact.map(rgb), ...quantize(pixels, TRANSPARENT - exact.length)];
}

/**
 * Maps every pixel to the nearest color in the palette
 * @param {Uint8Array} rgba
 * @param {number[][]} palette
 * @param {Int16Array} nearest the palette index of every color seen so far, or -1
 */
function palettize(rgba, palette, nearest) {
	const index = new Uint8Array(rgba.length / 4);

	for (let i = 0; i < index.length; i++) {
		const r = rgba[i * 4];
		const g = rgba[i * 4 + 1];
		const b = rgba[i * 4 + 2];
		const color = (r << 16) | (g << 8) | b;

		let found = nearest[color];

		if (found < 0) {
			let distance = Infinity;
			found = 0;

			for (let j = 0; j < palette.length; j++) {
				const [pr, pg, pb] = palette[j];
				const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
				if (d < distance) {
					distance = d;
					found = j;
				}
			}

			nearest[color] = found;
		}

		index[i] = found;
	}

	return index;
}

/**
 * Draws a frame onto the canvas
 * @param {Uint8Array} index the frame
 * @param {Uint8Array} canvas
 * @param {number} width
 * @param {number} height
 * @returns {Rect | undefined} the rectangle around the pixels that changed, where the ones that
 *   didn't are transparent, or nothing if no pixel changed
 */
function draw(index, canvas, width, height) {
	let x0 = width;
	let y0 = height;
	let x1 = -1;
	let y1 = -1;

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (index[y * width + x] !== canvas[y * width + x]) {
				x0 = Math.min(x0, x);
				x1 = Math.max(x1, x);
				y0 = Math.min(y0, y);
				y1 = y;
			}
		}
	}

	if (x1 < 0) return;

	const rect = { index: new Uint8Array(0), x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
	rect.index = new Uint8Array(rect.width * rect.height);

	for (let y = 0; y < rect.height; y++) {
		for (let x = 0; x < rect.width; x++) {
			const p = (y0 + y) * width + x0 + x;
			rect.index[y * rect.width + x] = index[p] === canvas[p] ? TRANSPARENT : index[p];
			canvas[p] = index[p];
		}
	}

	return rect;
}

/**
 * Writes a frame to the GIF
 * @param {Rect & { time: number }} frame
 * @param {number} next when the frame after it shows
 */
function write(frame, next) {
	const first = count++ === 0;
	const at = encoder.bytesView().length;

	encoder.writeFrame(frame.index, frame.width, frame.height, {
		delay: (next - frame.time) * 10,
		dispose: 1,
		...(first
			? {
					palette: [...palette, ...Array.from({ length: 256 - palette.length }, () => [0, 0, 0])],
					repeat: 0
				}
			: { transparent: true, transparentIndex: TRANSPARENT })
	});

	// gifenc puts every frame in the top left corner. Move it to where the rectangle goes: the
	// frame's position follows its 8 byte graphic control extension and an 0x2c
	if (!first) {
		const bytes = encoder.bytesView();
		if (bytes[at + 8] !== 0x2c) throw new Error('Unexpected GIF frame layout');
		bytes.set([frame.x & 255, frame.x >> 8, frame.y & 255, frame.y >> 8], at + 9);
	}
}
