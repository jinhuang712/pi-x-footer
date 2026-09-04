import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "../src/config/defaults.js";
import type { FooterRowConfig } from "../src/config/types.js";
import { layoutFooter } from "../src/layout/layout-engine.js";
import { fitRow } from "../src/layout/responsive.js";
import type { ResolvedSegment } from "../src/segments/types.js";
import { createEmptySnapshot } from "../src/state/snapshot.js";
import type { FooterSnapshot } from "../src/state/types.js";

const segment = (
	id: ResolvedSegment["id"],
	text: string,
	priority: number,
	extra: Partial<ResolvedSegment> = {},
): ResolvedSegment => ({
	id,
	text,
	priority,
	required: false,
	...extra,
});

function snapshotWith(overrides: Partial<FooterSnapshot> = {}): FooterSnapshot {
	return { ...createEmptySnapshot(), ...overrides };
}

describe("layoutFooter", () => {
	it.each([40, 60, 80, 120])(
		"renders multiple rows with independent left and right alignment at %i columns",
		(width) => {
			const config = createDefaultConfig();
			config.layout = {
				rows: [
					{
						id: "identity",
						left: ["cwd", "git"],
						right: ["model"],
						visible: "always",
						overflow: "hide",
					},
					{ id: "usage", left: ["context"], right: ["cost"], visible: "always", overflow: "hide" },
				],
			};
			const result = layoutFooter(
				snapshotWith(),
				config,
				[
					segment("cwd", "project", 50),
					segment("git", "main", 70),
					segment("model", "gpt-5.6", 100),
					segment("context", "ctx 20.0%/100k", 100),
					segment("cost", "$0.123", 70),
				],
				width,
			);

			expect(result.lines).toHaveLength(2);
			expect(result.lines[0]).toContain("project · main");
			expect(result.lines[0]).toContain("gpt-5.6");
			expect(result.lines[1]).toContain("ctx 20.0%/100k");
			expect(result.lines[1]).toContain("$0.123");
			expect(visibleWidth(result.lines[0] ?? "")).toBe(width);
		},
	);

	it("hides optional low-priority Segments before required values", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{
					id: "one",
					left: ["cwd", "git", "model"],
					right: [],
					visible: "always",
					overflow: "hide",
				},
			],
		};
		const result = layoutFooter(
			snapshotWith(),
			config,
			[
				segment("cwd", "very-long-project-directory", 10),
				segment("git", "main", 20),
				segment("model", "gpt-5.6", 100, { required: true }),
			],
			20,
		);

		expect(result.lines[0]).toContain("gpt-5.6");
		expect(result.hidden).toEqual(["cwd"]);
		expect(visibleWidth(result.lines[0] ?? "")).toBeLessThanOrEqual(20);
	});

	it("applies the configured compact-before-hide strategy", () => {
		const config = createDefaultConfig();
		config.responsive.strategy = "compact-hide-truncate";
		config.layout = {
			rows: [
				{
					id: "one",
					left: ["cwd", "model"],
					right: [],
					visible: "always",
					overflow: "hide",
				},
			],
		};
		const result = layoutFooter(
			snapshotWith(),
			config,
			[
				segment("cwd", "optional-project-name", 10, { compactText: "p" }),
				segment("model", "required-model-name", 100, {
					compactText: "m",
					required: true,
				}),
			],
			8,
		);

		expect(result.hidden).toEqual([]);
		expect(result.lines[0]).toBe("p · m");
	});

	it("truncates optional Segments without configurable minimum widths", () => {
		const row: FooterRowConfig = {
			id: "one",
			left: ["cwd", "git"],
			right: [],
			visible: "always",
			overflow: "truncate",
		};
		const result = fitRow(
			row,
			[segment("cwd", "abcdefgh", 10), segment("git", "123456", 20)],
			[],
			"·",
			10,
		);

		expect(visibleWidth(result.left.map((item) => item.text).join("·"))).toBeLessThanOrEqual(10);
	});

	it("uses compact text before truncating when configured", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{
					id: "one",
					left: ["model", "context"],
					right: [],
					visible: "always",
					overflow: "compact",
				},
			],
		};
		const result = layoutFooter(
			snapshotWith(),
			config,
			[
				segment("model", "provider/very-long-model-name", 100, {
					compactText: "long-model",
					required: true,
				}),
				segment("context", "ctx 20.0%/200k", 100, { required: true }),
			],
			30,
		);

		expect(result.lines[0]).toContain("long-model");
		expect(visibleWidth(result.lines[0] ?? "")).toBeLessThanOrEqual(30);
	});

	it("applies conditional row visibility", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{
					id: "streaming",
					left: ["tools"],
					right: [],
					visible: "when-streaming",
					overflow: "hide",
				},
				{
					id: "warning",
					left: ["context"],
					right: [],
					visible: "when-state-is-warning",
					overflow: "hide",
				},
			],
		};
		const baseSegments = [
			segment("tools", "tool:bash", 60, { state: "info" }),
			segment("context", "ctx 95.0%/100k", 100, { state: "error" }),
		];

		const idle = layoutFooter(snapshotWith(), config, baseSegments, 40);
		expect(idle.lines).toEqual([]);

		const streaming = layoutFooter(
			snapshotWith({ session: { ...createEmptySnapshot().session, isStreaming: true } }),
			config,
			baseSegments,
			40,
		);
		expect(streaming.lines).toEqual(["tool:bash"]);
	});

	it("omits empty conditional rows and respects zero width", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{
					id: "optional",
					left: ["provider_usage"],
					right: [],
					visible: "when-available",
					overflow: "hide",
				},
			],
		};
		expect(layoutFooter(snapshotWith(), config, [], 0)).toEqual({
			rows: [],
			lines: [],
			hidden: [],
		});
		expect(layoutFooter(snapshotWith(), config, [], 80).lines).toEqual([]);
	});

	it("omits explicitly empty rows without merging neighboring rows", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{ id: "first", left: ["git"], right: [], visible: "always", overflow: "hide" },
				{ id: "empty", left: [], right: [], visible: "always", overflow: "hide" },
				{ id: "last", left: ["model"], right: [], visible: "always", overflow: "hide" },
			],
		};
		const result = layoutFooter(
			snapshotWith(),
			config,
			[segment("git", "main", 70), segment("model", "gpt-5.6", 100)],
			80,
		);

		expect(result.rows.map((row) => row.id)).toEqual(["first", "last"]);
		expect(result.lines).toEqual(["main", "gpt-5.6"]);
	});

	it("moves later rows up when Git and provider usage are unavailable", () => {
		const config = createDefaultConfig();
		const snapshot = snapshotWith({
			session: { ...createEmptySnapshot().session, cwd: "/workspace/project", model: "gpt-5.6" },
			conversation: { context: { usedTokens: 0, limitTokens: 272_000, usedPercent: 0 } },
		});
		const result = layoutFooter(
			snapshot,
			config,
			[
				segment("cwd", "Project: project", 85),
				segment("identity", "openai-codex: gpt-5.6", 100, { required: true }),
				segment("context", "Context: 0/272k (0.0%)", 100, { required: true }),
				segment("tokens", "Tokens: ↓0 ↑0", 45),
				segment("cache", "Cache: 0", 65),
			],
			80,
		);

		expect(result.rows.map((row) => row.id)).toEqual(["project", "git", "session"]);
		expect(result.lines).toHaveLength(3);
		expect(result.lines[1]).toContain("Context: 0/272k");
		expect(result.lines[2]).toContain("Tokens: ↓0 ↑0");
	});

	it("keeps right-only content in its configured row", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{
					id: "identity",
					left: ["cwd", "git"],
					right: ["identity"],
					visible: "always",
					overflow: "hide",
				},
				{
					id: "usage-context",
					left: ["provider_usage"],
					right: ["context"],
					visible: "always",
					overflow: "hide",
				},
				{
					id: "tokens-cost",
					left: ["tokens", "cache"],
					right: ["cost"],
					visible: "always",
					overflow: "hide",
				},
			],
		};
		// provider_usage is unavailable, but Context remains in its configured
		// right group instead of moving into the following row.
		const result = layoutFooter(
			snapshotWith(),
			config,
			[
				segment("cwd", "project", 85),
				segment("git", "main", 70),
				segment("identity", "openai-codex: gpt-5.6-luna (xhigh)", 100),
				segment("context", "ctx 15.3%/1.0m", 100, { required: true }),
				segment("tokens", "in 211k", 55),
				segment("cache", "cache 98.8%", 65),
				segment("cost", "$0.033", 70),
			],
			100,
		);

		expect(result.lines).toHaveLength(3);
		expect(result.lines[0]).toContain("openai-codex");
		expect(result.rows[1]?.id).toBe("usage-context");
		expect(result.lines[1]).toContain("ctx 15.3%/1.0m");
		expect(result.rows[2]?.id).toBe("tokens-cost");
		expect(result.lines[2]).toContain("cache 98.8%");
	});

	it("keeps trailing lone right-group content right-aligned", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{
					id: "identity",
					left: ["git"],
					right: ["model"],
					visible: "always",
					overflow: "hide",
				},
				{ id: "context", left: [], right: ["context"], visible: "always", overflow: "hide" },
			],
		};
		const result = layoutFooter(
			snapshotWith(),
			config,
			[
				segment("git", "main", 70),
				segment("model", "gpt-5.6", 100),
				segment("context", "ctx 20.0%/100k", 100, { required: true }),
			],
			40,
		);

		expect(result.lines).toHaveLength(2);
		expect(result.lines[1]?.trimStart()).toBe("ctx 20.0%/100k");
	});

	it("truncates a long project instead of dropping it when the model name is also long", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{
					id: "project",
					left: ["cwd"],
					right: ["identity"],
					visible: "always",
					overflow: "hide",
				},
			],
		};
		const result = layoutFooter(
			snapshotWith(),
			config,
			[
				segment("cwd", "Project: /Users/jin.huang/dev/very-long-project-name", 85, {
					compactText: "very-long-project-name",
				}),
				segment("identity", "opencode-zen: muse-spark-1.3-contributor-free (xhigh)", 100, {
					compactText: "muse-spark-1.3-contributor-free (xhigh)",
					required: true,
				}),
			],
			80,
		);

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.left).toHaveLength(1);
		expect(result.rows[0]?.right).toHaveLength(1);
		expect(result.hidden).toEqual([]);
		expect(result.lines[0]).toContain("very-long-project-name");
		expect(result.lines[0]).toContain("muse-spark-1.3-contributor-free");
		expect(visibleWidth(result.lines[0] ?? "")).toBeLessThanOrEqual(80);
	});

	it("hides lower-priority segments before emptying a two-sided group", () => {
		const config = createDefaultConfig();
		config.layout = {
			rows: [
				{
					id: "project",
					left: ["cwd", "git"],
					right: ["identity"],
					visible: "always",
					overflow: "hide",
				},
			],
		};
		const result = layoutFooter(
			snapshotWith(),
			config,
			[
				segment("cwd", "Project: my-project", 85, { compactText: "my-project" }),
				segment("git", "Git: a-very-long-branch-name-for-testing", 70),
				segment("identity", "provider: model (xhigh)", 100, { required: true }),
			],
			50,
		);

		expect(result.hidden).toEqual(["git"]);
		expect(result.rows[0]?.left.map((item) => item.id)).toEqual(["cwd"]);
		expect(result.rows[0]?.right.map((item) => item.id)).toEqual(["identity"]);
		expect(visibleWidth(result.lines[0] ?? "")).toBeLessThanOrEqual(50);
	});
});
