import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { generate } from '../../scripts/build-script.js';
import { SCRIPT, SCRIPT_HASH } from '../lib/generated/script.js';

test('the generated script is up to date with src/script/capture.js', async () => {
	const generated = readFileSync(new URL('../lib/generated/script.js', import.meta.url), 'utf8');
	expect(generated).toBe(await generate());
});

test('SCRIPT_HASH is the CSP hash of SCRIPT', () => {
	const hash = createHash('sha256').update(SCRIPT).digest('base64');
	expect(SCRIPT_HASH).toBe(`sha256-${hash}`);
});

test('the script stays around 1 kB gzipped', () => {
	expect(gzipSync(SCRIPT, { level: 9 }).length).toBeLessThan(1200);
});
