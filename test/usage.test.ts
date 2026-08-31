import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFooterStore } from "../src/state/store.js";
import type { ProviderUsageSnapshot } from "../src/state/types.js";
import { resolveRuntimeUsageAuth } from "../src/usage/auth.js";
import { UsageCache } from "../src/usage/cache.js";
import { UsageError } from "../src/usage/errors.js";
import { fetchUsageJson, isOfficialUsageOrigin } from "../src/usage/http.js";
import { createUsageManager } from "../src/usage/manager.js";
import {
	normalizeArkAgentPlanUsage,
	normalizeArkCodingPlanUsage,
	normalizeCodexUsage,
	normalizeOpenCodeUsage,
} from "../src/usage/normalize.js";
import {
	createArkAgentPlanUsageAdapter,
	createArkCodingPlanUsageAdapter,
	createCodexUsageAdapter,
	createOpenCodeGoUsageAdapter,
} from "../src/usage/providers/index.js";
import type { UsageAuth, UsageProviderAdapter, UsageSessionContext } from "../src/usage/types.js";

const now = 1_700_000_000_000;

afterEach(() => {
	vi.useRealTimers();
});
const auth: UsageAuth = {
	headers: { Authorization: "Bearer test-token" },
	baseUrl: "https://chatgpt.com/backend-api",
	fingerprint: "fingerprint-1",
};

function fixture(name: string): unknown {
	return JSON.parse(readFileSync(new URL(`./fixtures/usage/${name}`, import.meta.url), "utf8"));
}

function sessionContext(overrides: Partial<UsageSessionContext> = {}): UsageSessionContext {
	return {
		provider: "openai-codex",
		model: "gpt-5.6",
		baseUrl: "https://chatgpt.com/backend-api",
		resolveAuth: async () => auth,
		...overrides,
	};
}

describe("usage normalization", () => {
	it("normalizes checked-in provider fixtures", () => {
		const codex = normalizeCodexUsage(fixture("codex-additional.json"), now);
		const zen = normalizeOpenCodeUsage(fixture("opencode-go.json"), now);
		const ark = normalizeArkAgentPlanUsage(fixture("ark-agent-plan.json"), now);
		expect(codex.windows).toHaveLength(2);
		expect(codex.windows[1]).toMatchObject({ usedPercent: 75, state: "warning" });
		expect(zen.windows.map((window) => window.label)).toEqual(["5h", "w", "m"]);
		expect(ark.windows.map((window) => window.id)).toEqual(["5h", "weekly", "monthly"]);
		const coding = normalizeArkCodingPlanUsage(fixture("ark-coding-plan.json"), now);
		expect(coding.windows.map((window) => window.id)).toEqual(["session", "weekly", "monthly"]);
		expect(coding.windows.map((window) => window.label)).toEqual(["5h", "w", "m"]);
		expect(coding.windows.map((window) => window.usedPercent)).toEqual([12, 45, 73]);
		expect(coding.windows[2]).toMatchObject({ usedPercent: 73, state: "warning" });
		expect(ark.windows.map((window) => window.usedPercent)).toEqual([
			5.053618, 66.2701897142857, 80.6727889,
		]);
		expect(() => normalizeOpenCodeUsage(fixture("malformed.json"), now)).toThrow(UsageError);
	});

	it("normalizes Codex windows to used percentages and compact labels", () => {
		const snapshot = normalizeCodexUsage(
			{
				rate_limit: {
					primary_window: {
						used_percent: 59,
						limit_window_seconds: 18_000,
						reset_at: now / 1000 + 3600,
					},
					secondary_window: {
						used_percent: 61,
						limit_window_seconds: 604_800,
						reset_at: now / 1000 + 86_400,
					},
				},
			},
			now,
		);
		expect(snapshot).toMatchObject({ provider: "openai-codex", state: "fresh" });
		expect(snapshot.windows).toEqual([
			{
				id: "codex:primary",
				label: "5h",
				usedPercent: 59,
				resetAt: now + 3_600_000,
				state: "normal",
			},
			{
				id: "codex:secondary",
				label: "wk",
				usedPercent: 61,
				resetAt: now + 86_400_000,
				state: "normal",
			},
		]);
	});

	it("normalizes OpenCode rolling, weekly, and monthly windows", () => {
		const snapshot = normalizeOpenCodeUsage(
			{
				usage: {
					rolling: { status: "ok", percent: 0, resetsAt: new Date(now + 3_600_000).toISOString() },
					weekly: { status: "rate-limited", percent: 4, resetsAt: now / 1000 + 7_200 },
					monthly: { status: "ok", percent: 92, resetsAt: now / 1000 + 86_400 },
				},
			},
			now,
		);
		expect(
			snapshot.windows.map((window) => [window.id, window.label, window.usedPercent, window.state]),
		).toEqual([
			["rolling", "5h", 0, "normal"],
			["weekly", "w", 4, "warning"],
			["monthly", "m", 92, "error"],
		]);
	});

	it("marks expired windows and rejects unusable payloads", () => {
		const snapshot = normalizeCodexUsage(
			{ rate_limit: { primary_window: { used_percent: 101, reset_at: now / 1000 - 1 } } },
			now,
		);
		expect(snapshot.windows[0]).toMatchObject({ usedPercent: 101, state: "expired" });
		expect(() => normalizeOpenCodeUsage({ usage: {} }, now)).toThrow(UsageError);
	});

	it("normalizes Ark agent-plan quota windows and rejects inactive subscriptions", () => {
		const snapshot = normalizeArkAgentPlanUsage(
			{
				items: [
					{
						product: "agent-plan",
						subscribed: true,
						periods: [
							{ label: "5h", percent: 25, reset_at: "2026-08-28T20:30:15+08:00" },
							{ label: "weekly", percent: 12, reset_at: now + 86_400_000 },
							{ label: "monthly", percent: 95, reset_at: now + 3_600_000 },
						],
					},
				],
			},
			now,
		);
		expect(snapshot).toMatchObject({ provider: "volcengine-agent-plan", state: "fresh" });
		expect(snapshot.windows.map((window) => [window.id, window.usedPercent, window.state])).toEqual(
			[
				["5h", 25, "normal"],
				["weekly", 12, "normal"],
				["monthly", 95, "error"],
			],
		);
		expect(() => normalizeArkAgentPlanUsage({ items: [] }, now)).toThrow(UsageError);
		expect(() =>
			normalizeArkAgentPlanUsage(
				{ items: [{ product: "agent-plan", subscribed: false, periods: [] }] },
				now,
			),
		).toThrow("No active agent-plan subscription was found.");
	});
});

describe("usage adapters and origin policy", () => {
	it("accepts only official origins", () => {
		expect(isOfficialUsageOrigin("openai-codex", "https://chatgpt.com/backend-api")).toBe(true);
		expect(isOfficialUsageOrigin("openai-codex", "https://proxy.example.com")).toBe(false);
		expect(isOfficialUsageOrigin("opencode-go", "https://opencode.ai/zen/go/v1")).toBe(true);
		expect(isOfficialUsageOrigin("opencode-go", "https://opencode.ai/?token=bad")).toBe(false);
		expect(
			isOfficialUsageOrigin(
				"volcengine-agent-plan",
				"https://ark.cn-beijing.volces.com/api/plan/v3",
			),
		).toBe(true);
		expect(
			isOfficialUsageOrigin("volcengine-agent-plan", "https://ark.cn-beijing.volces.com/api/v3"),
		).toBe(false);
		expect(
			isOfficialUsageOrigin(
				"volcengine-agent-plan",
				"https://ark.ap-southeast.bytepluses.com/api/plan/v3",
			),
		).toBe(false);
		expect(
			isOfficialUsageOrigin(
				"volcengine-coding-plan",
				"https://ark.cn-beijing.volces.com/api/coding/v3",
			),
		).toBe(true);
		expect(
			isOfficialUsageOrigin(
				"volcengine-coding-plan",
				"https://ark.cn-beijing.volces.com/api/coding",
			),
		).toBe(true);
		expect(
			isOfficialUsageOrigin(
				"volcengine-coding-plan",
				"https://ark.cn-beijing.volces.com/api/plan/v3",
			),
		).toBe(false);
		expect(
			isOfficialUsageOrigin("volcengine-coding-plan", "https://ark.cn-beijing.volces.com/api/v3"),
		).toBe(false);
	});

	it("queries Codex and OpenCode through injected HTTP clients", async () => {
		let codexUrl = "";
		const codex = createCodexUsageAdapter();
		const codexResult = await codex.query({
			auth,
			signal: new AbortController().signal,
			timeoutMs: 1000,
			now: () => now,
			fetch: async (url) => {
				codexUrl = url;
				return new Response(
					JSON.stringify({ rate_limit: { primary_window: { used_percent: 10 } } }),
					{
						status: 200,
					},
				);
			},
		});
		expect(codexUrl).toBe("https://chatgpt.com/backend-api/wham/usage");
		expect(codexResult.windows[0]?.usedPercent).toBe(10);

		let zenUrl = "";
		const zen = createOpenCodeGoUsageAdapter();
		const zenResult = await zen.query({
			auth: { ...auth, baseUrl: "https://opencode.ai/zen/go/v1" },
			signal: new AbortController().signal,
			timeoutMs: 1000,
			fetch: async (url) => {
				zenUrl = url;
				return new Response(JSON.stringify({ usage: { rolling: { status: "ok", percent: 2 } } }), {
					status: 200,
				});
			},
		});
		expect(zenUrl).toBe("https://opencode.ai/zen/go/v1/usage");
		expect(zenResult.provider).toBe("opencode-go");
	});

	it("queries Ark agent-plan through an injected arkcli executor", async () => {
		let command = "";
		let args: string[] = [];
		const adapter = createArkAgentPlanUsageAdapter();
		const result = await adapter.query({
			auth: {
				headers: {},
				baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
				fingerprint: "ark",
			},
			signal: new AbortController().signal,
			timeoutMs: 1000,
			now: () => now,
			exec: async (execCommand, execArgs) => {
				command = execCommand;
				args = execArgs;
				return {
					stdout: JSON.stringify(fixture("ark-agent-plan.json")),
					stderr: "",
					code: 0,
					killed: false,
				};
			},
		});
		expect(command).toBe("arkcli");
		expect(args).toEqual(["usage", "plan", "--product", "agent-plan", "--format", "json"]);
		expect(result.provider).toBe("volcengine-agent-plan");
		expect(result.windows).toHaveLength(3);
		expect(result.windows[2]).toMatchObject({ usedPercent: 80.6727889, state: "warning" });
	});

	it("queries Ark coding-plan through an injected arkcli executor", async () => {
		let args: string[] = [];
		const adapter = createArkCodingPlanUsageAdapter();
		const result = await adapter.query({
			auth: {
				headers: {},
				baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
				fingerprint: "coding",
			},
			signal: new AbortController().signal,
			timeoutMs: 1000,
			now: () => now,
			exec: async (_command, execArgs) => {
				args = execArgs;
				return {
					stdout: JSON.stringify(fixture("ark-coding-plan.json")),
					stderr: "",
					code: 0,
					killed: false,
				};
			},
		});
		expect(args).toEqual(["usage", "plan", "--product", "coding-plan", "--format", "json"]);
		expect(result.provider).toBe("volcengine-coding-plan");
		expect(result.windows).toHaveLength(3);
		expect(result.windows[0]).toMatchObject({ id: "session", usedPercent: 12 });
	});

	it("maps arkcli login failures and missing CLI to safe errors", async () => {
		const adapter = createArkAgentPlanUsageAdapter();
		const base = {
			auth: {
				headers: {},
				baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
				fingerprint: "ark",
			},
			signal: new AbortController().signal,
			timeoutMs: 1000,
		} as const;

		await expect(
			adapter.query({
				...base,
				exec: async () => ({ stdout: "", stderr: "not configured", code: 1, killed: false }),
			}),
		).rejects.toMatchObject({ code: "auth" });
		await expect(
			adapter.query({
				...base,
				exec: async () => ({
					stdout: JSON.stringify({
						ok: false,
						error: { message: "not logged in" },
					}),
					stderr: "",
					code: 0,
					killed: false,
				}),
			}),
		).rejects.toMatchObject({ code: "auth" });
		await expect(
			adapter.query({
				...base,
				exec: async () => {
					throw Object.assign(new Error("spawn arkcli ENOENT"), { name: "Error" });
				},
			}),
		).rejects.toMatchObject({ code: "unsupported" });
	});

	it("does not query a custom Codex origin", () => {
		const adapter = createCodexUsageAdapter();
		expect(
			adapter.matches({ provider: "openai-codex", baseUrl: "https://proxy.example.com" }),
		).toBe(false);
	});

	it("only matches the official Ark plan origin", () => {
		const adapter = createArkAgentPlanUsageAdapter();
		expect(
			adapter.matches({
				provider: "volcengine-agent-plan",
				baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
			}),
		).toBe(true);
		expect(
			adapter.matches({
				provider: "volcengine-agent-plan",
				baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
			}),
		).toBe(false);
	});

	it("only matches the official Ark coding-plan origin", () => {
		const adapter = createArkCodingPlanUsageAdapter();
		expect(
			adapter.matches({
				provider: "volcengine-coding-plan",
				baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
			}),
		).toBe(true);
		expect(
			adapter.matches({
				provider: "volcengine-coding-plan",
				baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
			}),
		).toBe(false);
	});

	it("normalizes HTTP auth failures and aborts without exposing response bodies", async () => {
		await expect(
			fetchUsageJson(
				"https://chatgpt.com/backend-api/wham/usage",
				auth,
				new AbortController().signal,
				1000,
				async () => new Response("Bearer test-token", { status: 401 }),
			),
		).rejects.toMatchObject({ code: "unauthorized" });

		const controller = new AbortController();
		const pending = fetchUsageJson(
			"https://chatgpt.com/backend-api/wham/usage",
			auth,
			controller.signal,
			1000,
			async (_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
						once: true,
					});
				}),
		);
		controller.abort();
		await expect(pending).rejects.toMatchObject({ code: "aborted" });
	});
});

describe("usage cache and manager", () => {
	it("keeps bounded, non-secret cache entries", () => {
		const cache = new UsageCache(1);
		cache.set({
			key: "provider:fingerprint:model",
			snapshot: { provider: "openai-codex", state: "fresh", windows: [] },
			fetchedAt: now,
			expiresAt: now + 1000,
		});
		expect(cache.get("provider:fingerprint:model")?.key).toBe("provider:fingerprint:model");
		expect(cache.get("provider:fingerprint:model")?.snapshot).not.toHaveProperty("token");
	});

	it("queries once, serves the cache, and publishes stale data after failure", async () => {
		let currentTime = now;
		let calls = 0;
		let fail = false;
		const adapter: UsageProviderAdapter = {
			id: "openai-codex",
			displayName: "Codex",
			matches: () => true,
			async query() {
				calls += 1;
				if (fail) throw new UsageError("network", "request failed");
				return {
					provider: "openai-codex",
					state: "fresh",
					fetchedAt: currentTime,
					windows: [{ id: "5h", label: "5h", usedPercent: 20, state: "normal" }],
				};
			},
		};
		const store = createFooterStore();
		const manager = createUsageManager({
			store,
			providers: ["openai-codex"],
			refreshSeconds: 3600,
			cacheTtlMs: 100,
			adapters: [adapter],
			now: () => currentTime,
		});

		manager.sessionStart(sessionContext());
		await manager.refresh();
		expect(calls).toBe(1);
		await manager.refresh();
		expect(calls).toBe(1);
		currentTime += 101;
		fail = true;
		await manager.refresh();
		expect(calls).toBe(2);
		expect(store.getSnapshot().providerUsage).toMatchObject({
			state: "stale",
			errorCode: "network",
		});
		manager.sessionShutdown();
	});

	it("debounces turn refreshes and stops periodic timers on shutdown", async () => {
		vi.useFakeTimers();
		let calls = 0;
		const adapter: UsageProviderAdapter = {
			id: "openai-codex",
			displayName: "Codex",
			matches: () => true,
			async query() {
				calls += 1;
				return {
					provider: "openai-codex",
					state: "fresh",
					windows: [],
				};
			},
		};
		const manager = createUsageManager({
			store: createFooterStore(),
			providers: ["openai-codex"],
			refreshSeconds: 1,
			debounceMs: 100,
			cacheTtlMs: 0,
			adapters: [adapter],
		});
		const context = sessionContext();

		manager.sessionStart(context);
		await manager.refresh();
		expect(calls).toBe(1);
		manager.turnEnded(context);
		manager.turnEnded(context);
		await vi.advanceTimersByTimeAsync(99);
		expect(calls).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toBe(2);
		await vi.advanceTimersByTimeAsync(899);
		expect(calls).toBe(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toBe(3);
		manager.sessionShutdown();
		await vi.advanceTimersByTimeAsync(1000);
		expect(calls).toBe(3);
	});

	it("clears a previous session timer when the replacement has no adapter", async () => {
		vi.useFakeTimers();
		const adapter: UsageProviderAdapter = {
			id: "openai-codex",
			displayName: "Codex",
			matches: () => true,
			async query() {
				return { provider: "openai-codex", state: "fresh", windows: [] };
			},
		};
		const manager = createUsageManager({
			store: createFooterStore(),
			providers: ["openai-codex"],
			refreshSeconds: 1,
			adapters: [adapter],
		});

		manager.sessionStart(sessionContext());
		await manager.refresh();
		expect(vi.getTimerCount()).toBe(1);
		manager.sessionStart(sessionContext({ provider: "unsupported" }));
		expect(vi.getTimerCount()).toBe(0);
		manager.sessionShutdown();
	});

	it("ignores a late response after the active model changes", async () => {
		const pending = new Map<string, (snapshot: ProviderUsageSnapshot) => void>();
		const adapter: UsageProviderAdapter = {
			id: "openai-codex",
			displayName: "Codex",
			matches: () => true,
			async query({ auth: queryAuth }) {
				return new Promise((resolve) => pending.set(queryAuth.fingerprint, resolve));
			},
		};
		const modelContext = (model: string): UsageSessionContext =>
			sessionContext({
				model,
				resolveAuth: async () => ({ ...auth, fingerprint: model }),
			});
		const store = createFooterStore();
		const manager = createUsageManager({
			store,
			providers: ["openai-codex"],
			refreshSeconds: 3600,
			adapters: [adapter],
		});

		manager.sessionStart(modelContext("model-a"));
		await Promise.resolve();
		manager.modelChanged(modelContext("model-b"));
		await Promise.resolve();
		expect(pending.has("model-a")).toBe(true);
		expect(pending.has("model-b")).toBe(true);

		pending.get("model-a")?.({
			provider: "openai-codex",
			state: "fresh",
			windows: [{ id: "5h", label: "5h", usedPercent: 10, state: "normal" }],
		});
		await Promise.resolve();
		expect(store.getSnapshot().providerUsage?.windows).toEqual([]);

		const current = manager.refresh();
		pending.get("model-b")?.({
			provider: "openai-codex",
			state: "fresh",
			windows: [{ id: "5h", label: "5h", usedPercent: 20, state: "normal" }],
		});
		await current;
		expect(store.getSnapshot().providerUsage?.windows[0]?.usedPercent).toBe(20);
		manager.sessionShutdown();
	});
});

describe("runtime usage auth", () => {
	it("uses the selected model auth and fingerprints without exposing it", async () => {
		const ctx = {
			model: {
				provider: "openai-codex",
				id: "gpt-5.6",
				baseUrl: "https://chatgpt.com/backend-api",
			},
			modelRegistry: {
				getApiKeyAndHeaders: async () => ({
					ok: true,
					headers: { Authorization: "Bearer test-token" },
					baseUrl: "https://chatgpt.com/backend-api",
				}),
			},
		} as never;
		const resolved = await resolveRuntimeUsageAuth(
			ctx,
			"openai-codex",
			new AbortController().signal,
		);
		expect(resolved).toMatchObject({ baseUrl: "https://chatgpt.com/backend-api" });
		expect(resolved?.fingerprint).not.toContain("test-token");
	});

	it("fails closed for custom origins before resolving credentials", async () => {
		let called = false;
		const ctx = {
			model: { provider: "openai-codex", id: "gpt-5.6", baseUrl: "https://proxy.example.com" },
			modelRegistry: {
				getApiKeyAndHeaders: async () => {
					called = true;
					return { ok: false, error: "unexpected" };
				},
			},
		} as never;
		await expect(
			resolveRuntimeUsageAuth(ctx, "openai-codex", new AbortController().signal),
		).rejects.toThrow("custom or proxy");
		expect(called).toBe(false);
	});

	it("resolves Ark agent-plan auth without an HTTP credential", async () => {
		let called = false;
		const ctx = {
			model: {
				provider: "volcengine-agent-plan",
				id: "doubao-seed-1-6",
				baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
			},
			modelRegistry: {
				getApiKeyAndHeaders: async () => {
					called = true;
					return { ok: true, headers: {}, baseUrl: undefined };
				},
			},
		} as never;
		const resolved = await resolveRuntimeUsageAuth(
			ctx,
			"volcengine-agent-plan",
			new AbortController().signal,
		);
		expect(called).toBe(false);
		expect(resolved).toMatchObject({
			headers: {},
			baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
		});
		expect(resolved?.fingerprint).toBeTruthy();
	});

	it("resolves Ark coding-plan auth without an HTTP credential", async () => {
		let called = false;
		const ctx = {
			model: {
				provider: "volcengine-coding-plan",
				id: "deepseek-v4-flash",
				baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
			},
			modelRegistry: {
				getApiKeyAndHeaders: async () => {
					called = true;
					return { ok: true, headers: {}, baseUrl: undefined };
				},
			},
		} as never;
		const resolved = await resolveRuntimeUsageAuth(
			ctx,
			"volcengine-coding-plan",
			new AbortController().signal,
		);
		expect(called).toBe(false);
		expect(resolved).toMatchObject({
			headers: {},
			baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
		});
		expect(resolved?.fingerprint).toBeTruthy();
	});
});
