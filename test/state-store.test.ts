import { describe, expect, it, vi } from "vitest";
import { createEmptySnapshot } from "../src/state/snapshot.js";
import { createFooterStore } from "../src/state/store.js";

describe("FooterSnapshot", () => {
	it("starts with a valid empty snapshot", () => {
		const snapshot = createEmptySnapshot(100);
		expect(snapshot).toEqual({
			version: 0,
			updatedAt: 100,
			session: { cwd: "", isStreaming: false },
			repository: { isRepository: false, state: "unavailable" },
			conversation: {},
			tools: { active: false, recent: [] },
			extensions: { statuses: [] },
			runtime: { mode: "unknown", sessionGeneration: 0 },
		});
	});
});

describe("FooterStore", () => {
	it("merges nested updates and increments version", () => {
		let currentTime = 100;
		const store = createFooterStore({ now: () => currentTime });

		currentTime = 200;
		const updated = store.update({
			session: { model: "gpt-5.6", cwd: "/workspace/project" },
			conversation: { context: { usedTokens: 100, limitTokens: 1000 } },
		});

		expect(updated.version).toBe(1);
		expect(updated.updatedAt).toBe(200);
		expect(updated.session).toMatchObject({ model: "gpt-5.6", cwd: "/workspace/project" });
		expect(updated.conversation.context).toEqual({ usedTokens: 100, limitTokens: 1000 });

		const next = store.update({ conversation: { context: { usedPercent: 10 } } });
		expect(next.version).toBe(2);
		expect(next.conversation.context).toEqual({
			usedTokens: 100,
			limitTokens: 1000,
			usedPercent: 10,
		});
	});

	it("does not publish or increment for an equivalent update", () => {
		const store = createFooterStore({ now: () => 100 });
		const listener = vi.fn();
		store.subscribe(listener);

		store.update({ session: { model: "gpt-5.6" } });
		store.update({ session: { model: "gpt-5.6" } });

		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.getSnapshot().version).toBe(1);
	});

	it("supports clearing provider usage explicitly", () => {
		const store = createFooterStore();
		store.update({
			providerUsage: {
				provider: "openai-codex",
				state: "fresh",
				windows: [{ id: "5h", label: "5h", usedPercent: 10, state: "normal" }],
			},
		});
		expect(store.getSnapshot().providerUsage).toBeDefined();

		store.update({ providerUsage: undefined });
		expect(store.getSnapshot().providerUsage).toBeUndefined();
	});

	it("copies mutable values at update and read boundaries", () => {
		const store = createFooterStore();
		const statuses = [{ key: "usage", text: "codex 10%", state: "normal" as const }];
		store.update({ extensions: { statuses } });
		const originalStatus = statuses[0];
		expect(originalStatus).toBeDefined();
		if (!originalStatus) return;
		originalStatus.text = "mutated outside";

		const snapshot = store.getSnapshot();
		const copiedStatus = snapshot.extensions.statuses[0];
		expect(copiedStatus).toBeDefined();
		if (!copiedStatus) return;
		copiedStatus.text = "mutated by reader";
		expect(store.getSnapshot().extensions.statuses[0]?.text).toBe("codex 10%");
	});

	it("unsubscribes listeners", () => {
		const store = createFooterStore();
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);
		unsubscribe();
		store.update({ session: { model: "gpt-5.6" } });
		expect(listener).not.toHaveBeenCalled();
	});
});
