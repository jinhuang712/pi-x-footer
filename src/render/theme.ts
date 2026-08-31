import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import type { ColorMode } from "../config/types.js";
import type { SemanticState } from "../segments/types.js";
import type { SemanticColorMap, SemanticRole, ThemeLike } from "./types.js";

export const DEFAULT_SEMANTIC_COLORS: SemanticColorMap = {
	text: "text",
	muted: "muted",
	dim: "dim",
	accent: "accent",
	info: "accent",
	success: "success",
	warning: "warning",
	error: "error",
};

export function roleForState(state: SemanticState | undefined): SemanticRole {
	switch (state) {
		case "muted":
			return "muted";
		case "info":
			return "info";
		case "success":
			return "success";
		case "warning":
			return "warning";
		case "error":
			return "error";
		default:
			return "text";
	}
}

export function colorForRole(
	role: SemanticRole,
	colors: SemanticColorMap = DEFAULT_SEMANTIC_COLORS,
): ThemeColor {
	return colors[role];
}

export function applySemanticColor(
	theme: ThemeLike | undefined,
	mode: ColorMode,
	role: SemanticRole,
	text: string,
	colors: SemanticColorMap = DEFAULT_SEMANTIC_COLORS,
): string {
	if (mode === "monochrome" || !theme || text.length === 0) return text;
	try {
		return theme.fg(colorForRole(role, colors), text);
	} catch {
		return text;
	}
}

export function styleSeparator(
	separator: string,
	mode: ColorMode,
	theme: ThemeLike | undefined,
	colors: SemanticColorMap = DEFAULT_SEMANTIC_COLORS,
): string {
	return applySemanticColor(theme, mode, "dim", separator, colors);
}
