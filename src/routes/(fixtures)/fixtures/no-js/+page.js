// This page never hydrates, so captured events are dropped once `timeout` expires
export const csr = false;

export function load() {
	return { replay: { timeout: 500 } };
}
