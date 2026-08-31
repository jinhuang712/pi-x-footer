import { describe, expect, it } from "vitest";
import type { SessionContext } from "../src/data/session.js";
import {
	createSessionDataSource,
	runtimeModeFromContext,
	sessionSnapshotFromContext,
} from "../src/data/session.js";
import { createFooterStore } from "../src/state/store.js";

const baseContext = (overrides: Partial<SessionContext> = {}): SessionContext => ({
	cwd: "/workspace/project",
	mode: "tui",
	model: {
		provider: "openai-codex",
		id: "gpt-5.6",
	},
	thinkingLevel: "high",
	...overrides,
});

describe("session data", () => {
	it("maps the active context to a session snapshot", () => {
		expect(sessionSnapshotFromContext(baseContext())).toEqual({
			provider: "openai-codex",
			model: "gpt-5.6",
			thinkingLevel: "high",
			cwd: "/workspace/project",
			isStreaming: false,
		});
	});

	it("leaves optional model fields absent when no model is selected", () => {
		expect(
			sessionSnapshotFromContext(
				baseContext({ model: undefined, thinkingLevel: undefined, mode: "rpc" }),
			),
		).toEqual({
			cwd: "/workspace/project",
			isStreaming: false,
		});
	});

	it("normalizes supported runtime modes", () => {
		expect(runtimeModeFromContext("tui")).toBe("tui");
		expect(runtimeModeFromContext("rpc")).toBe("rpc");
		expect(runtimeModeFromContext("print")).toBe("print");
		expect(runtimeModeFromContext("json")).toBe("json");
		expect(runtimeModeFromContext("future-mode" as SessionContext["mode"])).toBe("unknown");
	});
});

describe("SessionDataSource", () => {
	it("updates the store across session and model lifecycle changes", () => {
		const store = createFooterStore();
		const source = createSessionDataSource(store);
		const context = baseContext();

		source.sessionStart(context);
		expect(store.getSnapshot()).toMatchObject({
			session: {
				provider: "openai-codex",
				model: "gpt-5.6",
				thinkingLevel: "high",
				cwd: "/workspace/project",
				isStreaming: false,
			},
			runtime: { mode: "tui", sessionGeneration: 1 },
		});

		source.modelChanged(baseContext({ model: { provider: "anthropic", id: "claude-sonnet" } }));
		expect(store.getSnapshot().session).toMatchObject({
			provider: "anthropic",
			model: "claude-sonnet",
		});

		source.thinkingLevelChanged(baseContext({ thinkingLevel: "off" }));
		expect(store.getSnapshot().session.thinkingLevel).toBe("off");
	});

	it("tracks streaming state without changing the session generation", () => {
		const store = createFooterStore();
		const source = createSessionDataSource(store);
		const context = baseContext();
		source.sessionStart(context);
		source.agentStarted(context);
		expect(store.getSnapshot()).toMatchObject({
			session: { isStreaming: true },
			runtime: { sessionGeneration: 1 },
		});

		source.agentEnded(context);
		expect(store.getSnapshot()).toMatchObject({
			session: { isStreaming: false },
			runtime: { sessionGeneration: 1 },
		});
	});

	it("increments the generation for replacement sessions and clears streaming", () => {
		const store = createFooterStore();
		const source = createSessionDataSource(store);
		const context = baseContext();
		source.sessionStart(context);
		source.agentStarted(context);
		source.sessionShutdown(context);
		expect(store.getSnapshot()).toMatchObject({
			session: { isStreaming: false },
			runtime: { mode: "unknown", sessionGeneration: 1 },
		});

		source.sessionStart(baseContext({ cwd: "/workspace/other" }));
		expect(store.getSnapshot()).toMatchObject({
			session: { cwd: "/workspace/other", isStreaming: false },
			runtime: { mode: "tui", sessionGeneration: 2 },
		});
	});
});
