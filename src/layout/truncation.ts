import { stripTerminalSequences, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { LayoutSegment } from "./types.js";

export function compactSegments(segments: LayoutSegment[]): boolean {
	let changed = false;
	for (const segment of segments) {
		if (!segment.compactText || visibleWidth(segment.compactText) >= visibleWidth(segment.text))
			continue;
		segment.text = segment.compactText;
		changed = true;
	}
	return changed;
}

export function truncateSegment(segment: LayoutSegment, maxWidth: number): boolean {
	if (maxWidth < 1 || visibleWidth(segment.text) <= maxWidth) return false;
	// Layout operates on unstyled text. Pi's helper may append reset sequences even when
	// the input has no style, so remove those sequences before the style layer runs.
	const next = stripTerminalSequences(truncateToWidth(segment.text, maxWidth, "…"));
	if (next === segment.text) return false;
	segment.text = next;
	return true;
}
