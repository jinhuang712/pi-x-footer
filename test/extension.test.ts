import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import extension from "../src/index.js";

type SessionStartHandler = (event: unknown, context: unknown) => void | Promise<void>;
type CommandHandler = (args: string, context: unknown) => void | Promise<void>;

describe("pi-x-footer extension scaffold", () => {
	it("registers a Footer during a TUI session", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "pi-x-footer-test-"));
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			const handlers: Record<string, SessionStartHandler> = {};
			let footerFactory: ((...args: unknown[]) => unknown) | undefined;

			const pi = {
				registerCommand() {},
				on(event: string, handler: SessionStartHandler) {
					handlers[event] = handler;
				},
				exec: async () => ({ stdout: "", stderr: "", code: 128, killed: false }),
			} as never;

			extension(pi);
			expect(handlers.session_start).toBeDefined();

			const context = {
				mode: "tui",
				cwd: "/workspace/project",
				model: { provider: "openai-codex", id: "gpt-5.6" },
				thinkingLevel: "xhigh",
				sessionManager: { getEntries: () => [] },
				getContextUsage: () => undefined,
				ui: {
					setFooter(factory: (...args: unknown[]) => unknown) {
						footerFactory = factory;
					},
				},
			};

			await handlers.session_start?.({}, context);
			expect(footerFactory).toBeDefined();

			const component = footerFactory?.({ requestRender() {} }, {}, {});
			expect(component).toMatchObject({
				dispose: expect.any(Function),
				invalidate: expect.any(Function),
				render: expect.any(Function),
			});
			const lines = (component as { render(width: number): string[] }).render(80);
			expect(lines).toHaveLength(2);
			expect(lines[0]).toContain("Project: /workspace/project");
			expect(lines[0]).toContain("openai-codex: gpt-5.6 (xhigh)");
			expect(lines[1]).toContain("Tokens: ↓0 ↑0");
			expect(lines[1]).toContain("Cache: 0");
			await handlers.session_shutdown?.({}, context);
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
			rmSync(agentDir, { recursive: true, force: true });
		}
	});

	it("refreshes context limits when the selected model changes", async () => {
		const agentDir = mkdtempSync(join(tmpdir(), "pi-x-footer-test-"));
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			const handlers: Record<string, SessionStartHandler> = {};
			let footerFactory: ((...args: unknown[]) => unknown) | undefined;
			const pi = {
				registerCommand() {},
				on(event: string, handler: SessionStartHandler) {
					handlers[event] = handler;
				},
				exec: async () => ({ stdout: "", stderr: "", code: 128, killed: false }),
			} as never;
			extension(pi);

			let contextWindow = 272_000;
			const context = {
				mode: "tui",
				cwd: "/workspace/project",
				model: { provider: "openai-codex", id: "gpt-5.6" },
				thinkingLevel: "off",
				sessionManager: { getEntries: () => [] },
				getContextUsage: () => ({ tokens: 10_000, contextWindow }),
				ui: {
					setFooter(factory: (...args: unknown[]) => unknown) {
						footerFactory = factory;
					},
				},
			};

			await handlers.session_start?.({}, context);
			const component = footerFactory?.({ requestRender() {} }, {}, {}) as {
				render(width: number): string[];
			};
			expect(component.render(120).join("\n")).toContain("272k");

			contextWindow = 1_000_000;
			context.model = { provider: "opencode-go", id: "glm-5.3-flash" };
			await handlers.model_select?.({}, context);
			expect(component.render(120).join("\n")).toContain("1.0m");
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
			rmSync(agentDir, { recursive: true, force: true });
		}
	});

	it("cleans previous data sources on session replacement and shutdown", async () => {
		vi.useFakeTimers();
		try {
			const handlers: Record<string, SessionStartHandler> = {};
			const pi = {
				registerCommand() {},
				on(event: string, handler: SessionStartHandler) {
					handlers[event] = handler;
				},
				exec: async () => ({ stdout: "", stderr: "", code: 128, killed: false }),
			} as never;
			extension(pi);

			const context = {
				mode: "tui",
				cwd: "/workspace/project",
				model: undefined,
				thinkingLevel: "off",
				sessionManager: { getEntries: () => [] },
				getContextUsage: () => undefined,
				ui: { setFooter() {} },
			};

			await handlers.session_start?.({}, context);
			expect(vi.getTimerCount()).toBe(1);
			await handlers.session_start?.({}, context);
			expect(vi.getTimerCount()).toBe(1);
			handlers.session_shutdown?.({}, context);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it("stops and restarts data sources once when toggling the Footer", async () => {
		vi.useFakeTimers();
		const agentDir = mkdtempSync(join(tmpdir(), "pi-x-footer-test-"));
		const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
		process.env.PI_CODING_AGENT_DIR = agentDir;
		try {
			let sessionStart: SessionStartHandler | undefined;
			let sessionShutdown: SessionStartHandler | undefined;
			let command: CommandHandler | undefined;
			const pi = {
				registerCommand(_name: string, options: { handler: CommandHandler }) {
					command = options.handler;
				},
				on(event: string, handler: SessionStartHandler) {
					if (event === "session_start") sessionStart = handler;
					if (event === "session_shutdown") sessionShutdown = handler;
				},
				exec: async () => ({ stdout: "", stderr: "", code: 128, killed: false }),
			} as never;
			extension(pi);

			const context = {
				mode: "tui",
				cwd: "/workspace/project",
				model: {
					provider: "openai-codex",
					id: "gpt-5.6",
					baseUrl: "https://chatgpt.com/backend-api",
				},
				modelRegistry: {
					getApiKeyAndHeaders: async () => ({ ok: false, error: "missing auth" }),
				},
				thinkingLevel: "off",
				hasUI: false,
				sessionManager: { getEntries: () => [] },
				getContextUsage: () => undefined,
				ui: { setFooter() {}, notify() {} },
			};

			await sessionStart?.({}, context);
			expect(vi.getTimerCount()).toBe(2);
			await command?.("toggle", context);
			expect(vi.getTimerCount()).toBe(0);
			await command?.("toggle", context);
			expect(vi.getTimerCount()).toBe(2);
			sessionShutdown?.({}, context);
			expect(vi.getTimerCount()).toBe(0);
		} finally {
			if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
			else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
			rmSync(agentDir, { recursive: true, force: true });
			vi.useRealTimers();
		}
	});

	it("does not install a Footer outside TUI mode", async () => {
		let footerInstalled = false;
		let sessionStart: SessionStartHandler | undefined;

		const pi = {
			registerCommand() {},
			on(event: string, handler: SessionStartHandler) {
				if (event === "session_start") sessionStart = handler;
			},
			exec: async () => ({ stdout: "", stderr: "", code: 128, killed: false }),
		} as never;

		extension(pi);
		await sessionStart?.(
			{},
			{
				mode: "rpc",
				cwd: "/workspace/project",
				model: undefined,
				thinkingLevel: "off",
				sessionManager: { getEntries: () => [] },
				getContextUsage: () => undefined,
				ui: {
					setFooter() {
						footerInstalled = true;
					},
				},
			},
		);

		expect(footerInstalled).toBe(false);
	});
});
