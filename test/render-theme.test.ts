import { stripTerminalSequences } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { iconForSegment } from "../src/render/icons.js";
import { styleSegment } from "../src/render/presentation.js";
import { applySemanticColor, roleForState, styleSeparator } from "../src/render/theme.js";
import type { ThemeLike } from "../src/render/types.js";
import type { ResolvedSegment } from "../src/segments/types.js";

const fakeTheme: ThemeLike = {
	fg(color, text) {
		return `<${color}>${text}</${color}>`;
	},
};

const ansiTheme: ThemeLike = {
	fg(_color, text) {
		return `\u001b[38;5;2m${text}\u001b[0m`;
	},
};

function segment(overrides: Partial<ResolvedSegment> = {}): ResolvedSegment {
	return {
		id: "context",
		text: "ctx 72.0%/100k",
		priority: 100,
		required: true,
		...overrides,
	};
}

describe("semantic theme", () => {
	it("maps segment states to Pi theme roles", () => {
		expect(roleForState(undefined)).toBe("text");
		expect(roleForState("info")).toBe("info");
		expect(roleForState("success")).toBe("success");
		expect(roleForState("warning")).toBe("warning");
		expect(roleForState("error")).toBe("error");
		expect(roleForState("muted")).toBe("muted");
		expect(applySemanticColor(fakeTheme, "semantic", "warning", "ctx")).toBe(
			"<warning>ctx</warning>",
		);
		expect(applySemanticColor(fakeTheme, "monochrome", "warning", "ctx")).toBe("ctx");
		expect(styleSeparator(" · ", "semantic", fakeTheme)).toBe("<dim> · </dim>");
	});

	it("falls back to plain text when a theme implementation fails", () => {
		const brokenTheme: ThemeLike = {
			fg() {
				throw new Error("theme failure");
			},
		};
		expect(applySemanticColor(brokenTheme, "semantic", "error", "failure")).toBe("failure");
	});
});

describe("segment presentation", () => {
	it("keeps the default presentation text-only", () => {
		const styled = styleSegment(
			segment({ state: "warning" }),
			{ colorMode: "semantic", icons: "off" },
			fakeTheme,
		);
		expect(styled.icon).toBeUndefined();
		expect(styled.text).toBe("ctx 72.0%/100k");
		expect(styled.output).toBe("<warning>ctx 72.0%/100k</warning>");
	});

	it("adds textual status markers in monochrome mode", () => {
		const warning = styleSegment(segment({ state: "warning" }), {
			colorMode: "monochrome",
			icons: "off",
		});
		const error = styleSegment(segment({ state: "error" }), {
			colorMode: "monochrome",
			icons: "off",
		});
		const muted = styleSegment(segment({ state: "muted" }), {
			colorMode: "monochrome",
			icons: "off",
		});
		expect(warning.output).toBe("ctx 72.0%/100k !");
		expect(error.output).toBe("ctx 72.0%/100k !!");
		expect(muted.output).toBe("ctx 72.0%/100k ?");
	});

	it("colors provider usage windows independently when parts are present", () => {
		const styled = styleSegment(
			segment({
				id: "provider_usage",
				text: "codex 92.0% 5h · 41.0% wk",
				state: "warning",
				parts: [
					{ text: "codex ", state: "normal" },
					{ text: "92.0% 5h", state: "error" },
					{ text: " · " },
					{ text: "41.0% wk", state: "success" },
				],
			}),
			{ colorMode: "semantic", icons: "off" },
			fakeTheme,
		);

		expect(styled.parts.map((part) => part.output)).toEqual([
			"<text>codex </text>",
			"<error>92.0% 5h</error>",
			"<text> · </text>",
			"<success>41.0% wk</success>",
		]);
	});

	it("supports opt-in icon modes without changing Segment IDs", () => {
		expect(iconForSegment("model", "off")).toBeUndefined();
		expect(iconForSegment("model", "minimal")).toBe("m");
		expect(iconForSegment("model", "nerd")).toBe("◆");
		expect(iconForSegment("model", "emoji")).toBe("🤖");
		const styled = styleSegment(segment({ id: "model", text: "gpt-5.6" }), {
			colorMode: "semantic",
			icons: "minimal",
		});
		expect(styled.id).toBe("model");
		expect(styled.output).toBe("m gpt-5.6");
	});

	it("preserves visible width when only ANSI color is added", () => {
		const styled = styleSegment(segment(), { colorMode: "semantic", icons: "off" }, ansiTheme);
		expect(styled.output).toContain("\u001b[");
		expect(stripTerminalSequences(styled.output)).toBe(styled.text);
	});
});
