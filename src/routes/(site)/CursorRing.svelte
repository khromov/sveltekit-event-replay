<!--
@component
Dotted ripple rings that follow the mouse around the header, behind the content.

They live in their own layer rather than inside the masked grid: animating anything inside a masked
element makes Chrome and Safari repaint the whole mask on every frame, which makes the rings stutter.
-->
<script>
	import { onMount } from 'svelte';

	/** @type {HTMLElement} */
	let area;

	/** @type {SVGSVGElement} */
	let ring;

	onMount(() => {
		// a ring that trails a finger would only get in the way, and it's all motion
		const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!fine || reduced) return;

		// where the ring is, and where the pointer is
		let x = 0;
		let y = 0;
		let target_x = 0;
		let target_y = 0;
		let frame = 0;
		let placed = false;

		const render = () => {
			// ease towards the pointer, a quarter of the way each frame
			x += (target_x - x) * 0.25;
			y += (target_y - y) * 0.25;
			ring.style.transform = `translate3d(${x - 50}px, ${y - 50}px, 0)`;

			frame =
				Math.abs(target_x - x) > 0.1 || Math.abs(target_y - y) > 0.1
					? requestAnimationFrame(render)
					: 0;
		};

		/** @param {PointerEvent} event */
		const move = (event) => {
			const rect = area.getBoundingClientRect();
			target_x = event.clientX - rect.left;
			target_y = event.clientY - rect.top;

			const inside =
				target_x >= 0 && target_y >= 0 && target_x <= rect.width && target_y <= rect.height;

			// fade out over the lower half of the header, like the grid behind it
			const fade = Math.min(1, Math.max(0, (rect.height - target_y) / (rect.height * 0.5)));
			ring.style.opacity = inside ? String(fade) : '0';

			// appear where the pointer is, rather than gliding in from the last place it left
			if (!placed || !inside) {
				x = target_x;
				y = target_y;
				placed = inside;
			}

			if (!frame) frame = requestAnimationFrame(render);
		};

		const leave = () => {
			ring.style.opacity = '0';
			placed = false;
		};

		addEventListener('pointermove', move, { passive: true });
		document.documentElement.addEventListener('pointerleave', leave);

		return () => {
			cancelAnimationFrame(frame);
			removeEventListener('pointermove', move);
			document.documentElement.removeEventListener('pointerleave', leave);
		};
	});
</script>

<div class="area" aria-hidden="true" bind:this={area}>
	<svg class="ring" viewBox="-50 -50 100 100" bind:this={ring}>
		<!-- pathLength lets each ring's dasharray split it into a whole number of evenly spaced dots -->
		<circle r="14" pathLength="100" />
		<circle r="30" pathLength="100" />
		<circle r="48" pathLength="100" />
	</svg>
</div>

<style>
	.area {
		position: absolute;
		inset: 0 0 auto;
		z-index: -1;
		height: 38rem;
		overflow: hidden;
		pointer-events: none;
	}

	.ring {
		position: absolute;
		top: 0;
		left: 0;
		width: 100px;
		height: 100px;
		opacity: 0;
		transition: opacity 0.3s;
		will-change: transform, opacity;
	}

	/* dotted rings: zero-length dashes with round caps, each ring turning at its own pace */
	circle {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2.2;
		stroke-linecap: round;
		transform-box: fill-box;
		transform-origin: center;
		animation: spin 9s linear infinite;
	}

	circle:nth-child(1) {
		stroke-opacity: 0.7;
		stroke-dasharray: 0 8.3333; /* 12 dots */
	}

	circle:nth-child(2) {
		stroke-opacity: 0.45;
		stroke-dasharray: 0 4.1667; /* 24 dots */
		animation-duration: 14s;
		animation-direction: reverse;
	}

	circle:nth-child(3) {
		stroke-opacity: 0.25;
		stroke-dasharray: 0 2.7778; /* 36 dots */
		animation-duration: 22s;
	}

	@keyframes spin {
		to {
			rotate: 360deg;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ring {
			display: none;
		}
	}
</style>
