import type { IconMode, SegmentId } from "../config/types.js";
import type { IconSet } from "./types.js";

const MINIMAL_ICONS: Partial<Record<SegmentId, string>> = {
	identity: "i",
	provider: "p",
	model: "m",
	thinking: "t",
	cwd: "@",
	git: "git",
	context: "ctx",
	tokens: "tok",
	cache: "cache",
	cost: "$",
	tools: ">",
	provider_usage: "%",
	extensions: "ext",
};

const NERD_ICONS: Partial<Record<SegmentId, string>> = {
	identity: "◆",
	provider: "◈",
	model: "◆",
	thinking: "✦",
	cwd: "⌂",
	git: "⑂",
	context: "◒",
	tokens: "⇅",
	cache: "◌",
	cost: "$",
	tools: "⚙",
	provider_usage: "◷",
	extensions: "▦",
};

const EMOJI_ICONS: Partial<Record<SegmentId, string>> = {
	identity: "🤖",
	provider: "🔌",
	model: "🤖",
	thinking: "💭",
	cwd: "📁",
	git: "🌿",
	context: "🧠",
	tokens: "🔢",
	cache: "⚡",
	cost: "💰",
	tools: "🔧",
	provider_usage: "📊",
	extensions: "🧩",
};

export function createIconSet(mode: IconMode): IconSet {
	const icons =
		mode === "minimal"
			? MINIMAL_ICONS
			: mode === "nerd"
				? NERD_ICONS
				: mode === "emoji"
					? EMOJI_ICONS
					: {};
	return {
		mode,
		forSegment(id) {
			return icons[id];
		},
	};
}

export function iconForSegment(id: SegmentId, mode: IconMode): string | undefined {
	return createIconSet(mode).forSegment(id);
}
