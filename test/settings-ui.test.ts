import { describe, expect, it } from "vitest";
import type { FooterRowConfig } from "../src/config/types.js";
import {
	editLayoutSettings,
	type LayoutEditorRequest,
	type SettingsSelectRequest,
	selectSettings,
	settingsSelectItems,
} from "../src/settings-ui.js";

describe("settings menu presentation", () => {
	it("separates primary settings from muted preview descriptions", () => {
		expect(
			settingsSelectItems(["brief — ctx 17.8%", "detailed — ctx 17.8%/272k", "← Back"]),
		).toEqual([
			{ value: "brief — ctx 17.8%", label: "brief", description: "ctx 17.8%" },
			{
				value: "detailed — ctx 17.8%/272k",
				label: "detailed",
				description: "ctx 17.8%/272k",
			},
			{ value: "← Back", label: "← Back" },
		]);
	});

	it("navigates tabbed option groups with Tab without entering the search query", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		const promise = selectSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{
								fg: (_color, text) => text,
								bg: (_color, text) => `[selected]${text}[/selected]`,
								bold: (text) => text,
							},
							{},
							resolve,
						);
					});
				},
			},
			{
				title: "Footer settings",
				options: ["Project — Show Project", "Layout — Canvas", "Footer: On"],
				tabs: [
					{ title: "Components", options: ["Project — Show Project"] },
					{ title: "Layout", options: ["Layout — Canvas"] },
					{ title: "Appearance", options: ["Footer: On"] },
				],
			},
		);

		const initial = component?.render(80).join("\n") ?? "";
		expect(initial).toContain("[selected] Components [/selected]");
		const previewIndex = initial.indexOf("Preview: (no preview)");
		const tabsIndex = initial.indexOf("[selected] Components [/selected]");
		const separatorIndex = initial.lastIndexOf("─", tabsIndex);
		expect(previewIndex).toBeLessThan(separatorIndex);
		expect(separatorIndex).toBeLessThan(tabsIndex);
		expect(initial).toContain("Show Project");
		const searchIndex = initial.indexOf("> ");
		expect(tabsIndex).toBeLessThan(searchIndex);
		expect(searchIndex).toBeLessThan(initial.indexOf("Show Project"));
		expect(component?.render(80).join("\n")).not.toContain("Canvas");
		component?.handleInput?.("\t");
		expect(component?.render(80).join("\n")).toContain("Canvas");
		expect(component?.render(80).join("\n")).not.toContain("Show Project");
		component?.handleInput?.("\u001b[Z");
		expect(component?.render(80).join("\n")).toContain("Show Project");
		component?.handleInput?.("\u001b");
		await expect(promise).resolves.toBeUndefined();
	});

	it("activates a direct tab without showing a duplicate option row", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		const promise = selectSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{ fg: (_color, text) => text, bold: (text) => text },
							{},
							resolve,
						);
					});
				},
			},
			{
				title: "Footer settings",
				options: ["Project — Show Project", "Layout — Canvas"],
				tabs: [
					{ title: "Components", options: ["Project — Show Project"] },
					{
						title: "Layout",
						options: [],
						activateOnTab: "Layout — Canvas",
					},
				],
			},
		);

		component?.handleInput?.("\t");
		await expect(promise).resolves.toBe("Layout — Canvas");
	});

	it("matches native model search with a focused fuzzy query", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		let settled = false;
		const promise = selectSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{ fg: (_color, text) => text, bold: (text) => text },
							{},
							resolve,
						);
					});
				},
			},
			{
				title: "Footer settings",
				options: [
					"Footer: On",
					"Mode: custom — [compact / balanced / detailed / custom]",
					"Appearance — Detail level · Color · Icons · Separator",
					"Context — Show Context · Display · Label",
					"Cache — Show Cache · Label",
				],
			},
		).then((value) => {
			settled = true;
			return value;
		});

		expect(component?.render(80).join("\n")).toContain("> ");
		component?.handleInput?.("c");
		component?.handleInput?.("t");
		component?.handleInput?.("x");
		const filtered = component?.render(80).join("\n") ?? "";
		expect(filtered).toContain("Context");
		expect(filtered).not.toContain("Appearance");

		// Search input owns printable characters, including `e`, just like /model.
		component?.handleInput?.("e");
		await Promise.resolve();
		expect(settled).toBe(false);
		component?.handleInput?.("\u001b");
		await expect(promise).resolves.toBeUndefined();
	});

	it("lets the Layout canvas continue tab navigation without an extra menu", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		const promise = editLayoutSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{ fg: (_color, text) => text, bold: (text) => text },
							{},
							resolve,
						);
					});
				},
			},
			{
				title: "Layout — arrange Segments",
				rows: [{ id: "project", left: ["cwd"], right: [], visible: "always", overflow: "hide" }],
			},
		);

		component?.handleInput?.("\t");
		await expect(promise).resolves.toEqual({ kind: "tab", direction: 1 });
	});

	it("compacts a source row when its only Segment moves down", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		let saved: FooterRowConfig[] | undefined;
		const promise = editLayoutSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{ fg: (_color, text) => text, bold: (text) => text },
							{},
							resolve,
						);
					});
				},
			},
			{
				title: "Layout — arrange Segments",
				rows: [
					{ id: "source", left: [], right: ["cost"], visible: "always", overflow: "hide" },
					{ id: "target", left: ["tokens"], right: [], visible: "always", overflow: "hide" },
				],
				onChange(nextRows) {
					saved = structuredClone(nextRows);
					return true;
				},
			},
		);
		const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

		component?.handleInput?.("\r");
		await flush();
		component?.handleInput?.("\u001b[B");
		await flush();
		component?.handleInput?.("\r");
		await flush();

		expect(saved?.map((row) => row.id)).toEqual(["target"]);
		expect(saved?.[0]?.right).toEqual(["cost"]);
		component?.handleInput?.("\u001b");
		await expect(promise).resolves.toEqual({ kind: "exit" });
	});

	it("edits layout on a two-column canvas with movement and row commands", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		const updates: Array<{ rows: FooterRowConfig[]; message: string }> = [];
		const rows: FooterRowConfig[] = [
			{ id: "project", left: ["cwd"], right: ["identity"], visible: "always", overflow: "hide" },
			{ id: "git", left: ["git"], right: ["context"], visible: "always", overflow: "hide" },
			{
				id: "usage",
				left: ["provider_usage"],
				right: ["cost"],
				visible: "always",
				overflow: "hide",
			},
			{ id: "session", left: ["tokens"], right: ["cache"], visible: "always", overflow: "hide" },
		];
		const request: LayoutEditorRequest = {
			title: "Layout — arrange Segments",
			tabs: ["General", "Components", "Layout", "Appearance"],
			activeTab: 2,
			rows,
			labels: { cwd: "Project", identity: "Provider", git: "Git", context: "Context" },
			preview: () => [],
			onChange(nextRows, message) {
				updates.push({ rows: structuredClone(nextRows), message });
				return true;
			},
		};
		const promise = editLayoutSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{
								fg: (color, text) => `[${color}]${text}[/${color}]`,
								bold: (text) => `<b>${text}</b>`,
							},
							{},
							resolve,
						);
					});
				},
			},
			request,
		);
		const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

		const initial = component?.render(80).join("\n") ?? "";
		expect(initial).toContain("[text] General [/text]");
		expect(initial).toContain("[accent][text]<b> Layout");
		expect(initial).toContain("[dim]› Project[/dim]");
		component?.handleInput?.("\u001b[C");
		await flush();
		expect(component?.render(80).join("\n")).toContain("[dim]› Provider[/dim]");
		component?.handleInput?.("\u001b[D");
		await flush();
		expect(component?.render(80).join("\n")).toContain("[dim]› Project[/dim]");
		component?.handleInput?.("\r");
		await flush();
		expect(component?.render(80).join("\n")).toContain("[accent]<b>→ Project</b>[/accent]");
		component?.handleInput?.("\u001b[B");
		await flush();
		expect(updates).toHaveLength(0);
		const movedRow = component?.render(80).find((line) => line.includes("Git"));
		expect(movedRow).toContain("[text]  Git[/text]");
		expect(movedRow).toContain("[accent]<b>→ Proj");
		expect(movedRow).not.toContain("[accent]<b>→ Git");
		component?.handleInput?.("\u001b[C");
		await flush();
		expect(updates).toHaveLength(0);
		component?.handleInput?.("l");
		await flush();
		expect(updates).toHaveLength(0);
		component?.handleInput?.("r");
		await flush();
		expect(updates).toHaveLength(0);
		component?.handleInput?.("n");
		await flush();
		expect(updates).toHaveLength(0);
		component?.handleInput?.("x");
		await flush();
		expect(updates).toHaveLength(0);
		component?.handleInput?.("\r");
		await flush();
		expect(updates).toHaveLength(1);
		expect(updates.at(-1)?.rows.every((row) => row.left.length > 0 || row.right.length > 0)).toBe(
			true,
		);
		expect(updates.at(-1)?.rows.some((row) => row.id === "git")).toBe(false);
		component?.handleInput?.("\u001b");
		await expect(promise).resolves.toEqual({ kind: "exit" });
	});

	it("traverses within a left group before crossing to the right group", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		const rows: FooterRowConfig[] = [
			{
				id: "project",
				left: ["cwd", "git"],
				right: ["identity"],
				visible: "always",
				overflow: "hide",
			},
		];
		const promise = editLayoutSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{
								fg: (color, text) => `[${color}]${text}[/${color}]`,
								bold: (text) => `<b>${text}</b>`,
							},
							{},
							resolve,
						);
					});
				},
			},
			{
				title: "Layout — arrange Segments",
				rows,
				labels: { cwd: "Project", git: "Git", identity: "Provider" },
			},
		);
		const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

		component?.handleInput?.("\u001b[C");
		await flush();
		expect(component?.render(80).join("\n")).toContain("[dim]› Git");
		component?.handleInput?.("\u001b");
		await expect(promise).resolves.toEqual({ kind: "exit" });
	});

	it("can traverse to a neighboring Segment in the same group", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		const request: LayoutEditorRequest = {
			title: "Layout — arrange Segments",
			rows: [
				{
					id: "session",
					left: ["tokens", "cache"],
					right: [],
					visible: "always",
					overflow: "hide",
				},
			],
			labels: { tokens: "Tokens", cache: "Cache" },
			onChange: () => true,
		};
		const promise = editLayoutSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{
								fg: (color, text) => `[${color}]${text}[/${color}]`,
								bold: (text) => `<b>${text}</b>`,
							},
							{},
							resolve,
						);
					});
				},
			},
			request,
		);
		const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

		component?.handleInput?.("\u001b[C");
		await flush();
		expect(component?.render(200).join("\n")).toContain("[dim]› Cache");
		component?.handleInput?.("\r");
		await flush();
		expect(component?.render(200).join("\n")).toContain("[accent]<b>→ Cache</b>");
		component?.handleInput?.("\u001b");
		await flush();
		component?.handleInput?.("\u001b");
		await expect(promise).resolves.toEqual({ kind: "exit" });
	});

	it("uses arrows for within-side order and l/r for crossing the center", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		let saved: FooterRowConfig[] | undefined;
		const request: LayoutEditorRequest = {
			title: "Layout — arrange Segments",
			rows: [
				{
					id: "session",
					left: ["tokens", "cache"],
					right: [],
					visible: "always",
					overflow: "hide",
				},
			],
			labels: { tokens: "Tokens", cache: "Cache" },
			onChange(nextRows) {
				saved = structuredClone(nextRows);
				return true;
			},
		};
		const promise = editLayoutSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{
								fg: (color, text) => `[${color}]${text}[/${color}]`,
								bold: (text) => `<b>${text}</b>`,
							},
							{},
							resolve,
						);
					});
				},
			},
			request,
		);
		const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

		component?.handleInput?.("\r");
		await flush();
		component?.handleInput?.("\u001b[C");
		await flush();
		const reordered = component?.render(300).join("\n") ?? "";
		expect(reordered).toContain("[text]  Cache[/text] · [accent]<b>→ Tokens</b>");
		component?.handleInput?.("r");
		await flush();
		const crossed = component?.render(300).join("\n") ?? "";
		expect(crossed).toContain("[text]  Cache[/text]");
		expect(crossed).toContain("[accent]<b>→ Tokens</b>");
		component?.handleInput?.("\r");
		await flush();
		expect(saved?.[0]?.left).toEqual(["cache"]);
		expect(saved?.[0]?.right).toEqual(["tokens"]);
		component?.handleInput?.("\u001b");
		await expect(promise).resolves.toEqual({ kind: "exit" });
	});

	it("renders a live preview and saves the next value with the right arrow", async () => {
		let component:
			| { render(width: number): string[]; handleInput?(data: string): void }
			| undefined;
		let renders = 0;
		const request: SettingsSelectRequest = {
			title: "Color",
			options: ["Color: semantic - semantic colors", "Color: monochrome - plain text"],
			preview: ["openai-codex: gpt-5.6-luna (xhigh)", "Context: 64.4% · limit 272k"],
			cycles: {
				"Color: semantic - semantic colors": [
					"Color: semantic - semantic colors",
					"Color: monochrome - plain text",
				],
			},
		};
		const promise = selectSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => renders++ },
							{
								fg: (_color, text) => text,
								bold: (text) => text,
							},
							{},
							resolve,
						);
					});
				},
			},
			request,
		);

		expect(component?.render(80).join("\n")).toContain("gpt-5.6-luna");
		component?.handleInput?.("\u001b[C");
		expect(renders).toBe(0);
		await expect(promise).resolves.toBe("Color: monochrome - plain text");
	});

	it("colors On and Off options by state", () => {
		let component: { render(width: number): string[] } | undefined;
		selectSettings(
			{
				custom(factory) {
					return new Promise((resolve) => {
						component = factory(
							{ requestRender: () => {} },
							{
								fg: (color, text) => `[${color}]${text}[/${color}]`,
								bold: (text) => text,
							},
							{},
							resolve,
						);
					});
				},
			},
			{ title: "Footer", options: ["Show Footer: On", "Show Footer: Off"] },
		);
		const rendered = component?.render(80).join("\n") ?? "";
		expect(rendered).toContain("[success]");
		expect(rendered).toContain("[dim]");
	});
});
