# Changelog

## 0.1.0 (2026-11-15)


### Features

* add isReplayed() to tell replayed events from real ones ([e0dedb6](https://github.com/khromov/sveltekit-event-replay/commit/e0dedb6b753550b3bf673897fa20ad13c5c1472d))
* data-replay-key, and hold clicks from the start of hydration ([6d8678b](https://github.com/khromov/sveltekit-event-replay/commit/6d8678bba59f8d151e841a431e854de5434d2b2a))
* initial release ([a4c5f92](https://github.com/khromov/sveltekit-event-replay/commit/a4c5f92484cde24ecfd3e5ed0611219addd66386))
* support SvelteKit 2 and experimental.async, add sveltekit-event-replay/script ([d372d8e](https://github.com/khromov/sveltekit-event-replay/commit/d372d8e4d414388ff3e3e1eb6a5d153c3f4778d1))


### Bug Fixes

* count the timeout from the start of hydration, send typed values on native submits ([a373029](https://github.com/khromov/sveltekit-event-replay/commit/a37302935f758cdfbc7da356338fabb7d0a691d1))
* dedupe pointer presses like clicks, skip key-made clicks the app already handled ([2cb1a50](https://github.com/khromov/sveltekit-event-replay/commit/2cb1a503f1a25b3f61d00c6a2fd6c804dfe21bad))
* harden capture and replay against bad input and failing events ([c068c0d](https://github.com/khromov/sveltekit-event-replay/commit/c068c0d3e4068cfb01c0d014246223175cc6311c))
* replay clicks safely around native controls, disabled elements and hydration changes ([e8ee88b](https://github.com/khromov/sveltekit-event-replay/commit/e8ee88bafbe47486dca46c046b470b93ad4f049e))
* replay only the latest input event per field ([e0deeb9](https://github.com/khromov/sveltekit-event-replay/commit/e0deeb9a825b23c7a37ac9067f57df60e9104a49))
* replay shortcuts after page text changes, restore field values, group widget roles ([035e5fa](https://github.com/khromov/sveltekit-event-replay/commit/035e5fa0a7ee935d2aa9bd56c0320fb8576ba543))
