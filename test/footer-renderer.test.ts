import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "../src/config/defaults.js";
import { FooterComponent } from "../src/render/renderer.js";
import { createFooterStore } from "../src/state/store.js";

const theme = {
	fg(_color: string, text: string): string {
		return `\u001b[38;5;2m${text}\u001b[0m`;
	},
};

describe("FooterComponent", () => {
	it("renders resolved data through layout and semantic presentation", () => {
		const store = createFooterStore();
		const config = createDefaultConfig();
		config.segments.context.display = undefined;
		config.layout = {
			rows: [
				{
					id: "main",
					left: ["provider", "model"],
					right: ["context"],
					visible: "always",
					overflow: "hide",
				},
			],
		};
		store.update({
			session: { provider: "openai-codex", model: "gpt-5.6", cwd: "/workspace/project" },
			conversation: { context: { usedTokens: 80_000, limitTokens: 100_000, usedPercent: 80 } },
		});
		const component = new FooterComponent({
			store,
			config,
			theme,
			tui: { requestRender() {} },
		});

		const line = component.render(60)[0] ?? "";
		expect(line).toContain("gpt-5.6");
		expect(line).toContain("Context:");
		expect(line).toContain("80.0%");
		expect(line).toContain("80k/100k (80.0%)");
		expect(line).toContain("\u001b[");
		expect(visibleWidth(line)).toBe(60);
		component.dispose();
	});

	it("requests redraws for Snapshot changes and unsubscribes on dispose", () => {
		const store = createFooterStore();
		const config = createDefaultConfig();
		let redraws = 0;
		const component = new FooterComponent({
			store,
			config,
			tui: { requestRender: () => redraws++ },
		});

		store.update({ session: { cwd: "/workspace/project", model: "gpt-5.6" } });
		store.update({ session: { model: "gpt-5.7" } });
		expect(redraws).toBe(1);
		component.render(80);
		store.update({ session: { model: "gpt-5.8" } });
		expect(redraws).toBe(2);
		component.dispose();
		store.update({ session: { model: "gpt-5.7" } });
		expect(redraws).toBe(2);
		expect(component.render(80)).toEqual([]);
		component.dispose();
	});

	it("does not render when disabled", () => {
		const store = createFooterStore();
		const config = createDefaultConfig();
		config.enabled = false;
		const component = new FooterComponent({ store, config, tui: { requestRender() {} } });
		expect(component.render(80)).toEqual([]);
		component.dispose();
	});
});
