import { visibleWidth } from "@earendil-works/pi-tui";
import type { FooterConfig, SegmentId, VisibilityRule } from "../config/types.js";
import type { ResolvedSegment } from "../segments/types.js";
import type { FooterSnapshot } from "../state/types.js";
import { fitRow } from "./responsive.js";
import { separatorText } from "./separators.js";
import type { FooterLayoutResult, LayoutRowResult, LayoutSegment } from "./types.js";

export function layoutFooter(
	snapshot: FooterSnapshot,
	config: FooterConfig,
	segments: readonly ResolvedSegment[],
	width: number,
): FooterLayoutResult {
	if (width <= 0) return { rows: [], lines: [], hidden: [] };
	const byId = new Map<string, ResolvedSegment[]>();
	for (const segment of segments) {
		const candidates = byId.get(segment.id) ?? [];
		candidates.push(segment);
		byId.set(segment.id, candidates);
	}
	const rows: LayoutRowResult[] = [];
	const hidden: string[] = [];

	for (const row of config.layout.rows) {
		const left = resolveReferences(row.left, byId);
		const right = resolveReferences(row.right, byId);
		if (!isRowVisible(row.visible, snapshot, [...left, ...right])) continue;
		// Omit unavailable rows entirely so later configured rows move up without
		// leaving blank lines. A row with content in only one group is retained.
		if (left.length === 0 && right.length === 0) continue;

		const separator = separatorText(config.style.separator);
		const fitted = fitRow(row, left, right, separator, width, config.responsive.strategy);
		const line = renderAlignedGroups(
			fitted.left.map((segment) => segment.text),
			fitted.right.map((segment) => segment.text),
			separator,
			width,
		);
		rows.push({
			id: row.id,
			left: fitted.left,
			right: fitted.right,
			separator,
			line,
			width: visibleWidth(line),
			hidden: fitted.hidden,
		});
		hidden.push(...fitted.hidden);
	}

	return { rows, lines: rows.map((row) => row.line), hidden };
}

function resolveReferences(
	references: readonly SegmentId[],
	byId: ReadonlyMap<string, readonly ResolvedSegment[]>,
): LayoutSegment[] {
	const resolved: LayoutSegment[] = [];
	for (const id of references) {
		const candidates = byId.get(id);
		if (!candidates || candidates.length === 0) continue;
		resolved.push({ ...candidates[0] });
	}
	return resolved;
}

function isRowVisible(
	visibility: VisibilityRule,
	snapshot: FooterSnapshot,
	segments: readonly LayoutSegment[],
): boolean {
	switch (visibility) {
		case "always":
			return true;
		case "when-available":
		case "when-nonempty":
			return segments.length > 0;
		case "when-streaming":
			return snapshot.session.isStreaming;
		case "when-provider-supported":
			return snapshot.providerUsage !== undefined;
		case "when-state-is-warning":
			return segments.some((segment) => segment.state === "warning");
	}
}

export function renderAlignedGroups(
	left: readonly string[],
	right: readonly string[],
	separator: string,
	width: number,
): string {
	const leftText = left.join(separator);
	const rightText = right.join(separator);
	if (leftText && rightText) {
		const padding = Math.max(1, width - visibleWidth(leftText) - visibleWidth(rightText));
		return `${leftText}${" ".repeat(padding)}${rightText}`;
	}
	if (rightText) return `${" ".repeat(Math.max(0, width - visibleWidth(rightText)))}${rightText}`;
	return leftText;
}
