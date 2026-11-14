// The parts of gifenc that scripts/demo-gif.js uses. gifenc ships no types, and as a CommonJS
// module it only has a default export in Node
declare module 'gifenc' {
	type Color = number[];

	interface FrameOptions {
		/** the global palette on the first frame, a local one on the others */
		palette?: Color[];
		/** in milliseconds, rounded to the hundredths of a second that GIF stores */
		delay?: number;
		/** how many more times to play the GIF: 0 is forever, -1 is no more */
		repeat?: number;
		transparent?: boolean;
		transparentIndex?: number;
		/** what happens to the frame once its delay is over: 1 leaves it in place */
		dispose?: number;
	}

	interface Encoder {
		writeFrame(index: Uint8Array, width: number, height: number, options?: FrameOptions): void;
		finish(): void;
		bytes(): Uint8Array;
		/** what has been written so far, without copying it */
		bytesView(): Uint8Array;
	}

	const gifenc: {
		GIFEncoder(): Encoder;
		quantize(
			rgba: Uint8Array,
			max_colors: number,
			options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444' }
		): Color[];
		snapColorsToPalette(palette: Color[], known: Color[], threshold?: number): void;
	};

	export default gifenc;
}
