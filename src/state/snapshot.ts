import type { FooterSnapshot } from "./types.js";

export function createEmptySnapshot(now = Date.now()): FooterSnapshot {
	return {
		version: 0,
		updatedAt: now,
		session: {
			cwd: "",
			isStreaming: false,
		},
		repository: {
			isRepository: false,
			state: "unavailable",
		},
		conversation: {},
		tools: {
			active: false,
			recent: [],
		},
		extensions: {
			statuses: [],
		},
		runtime: {
			mode: "unknown",
			sessionGeneration: 0,
		},
	};
}

export function cloneSnapshot(snapshot: FooterSnapshot): FooterSnapshot {
	return structuredClone(snapshot);
}
