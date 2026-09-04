import { stripTerminalSequences, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { FooterRowConfig, ResponsiveStrategy } from "../config/types.js";
import { compactSegments, truncateSegment } from "./truncation.js";
import type { LayoutSegment } from "./types.js";

export interface FittedRow {
	left: LayoutSegment[];
	right: LayoutSegment[];
	hidden: string[];
}

export function fitRow(
	row: FooterRowConfig,
	left: readonly LayoutSegment[],
	right: readonly LayoutSegment[],
	separator: string,
	width: number,
	strategy: ResponsiveStrategy = "hide-compact-truncate",
): FittedRow {
	const fittedLeft = left.map(cloneSegment);
	const fittedRight = right.map(cloneSegment);
	const hidden: string[] = [];
	const all = () => [...fittedLeft, ...fittedRight];
	const measure = () => measureGroups(fittedLeft, fittedRight, separator);
	const effectiveStrategy =
		row.overflow === "compact"
			? "compact-hide-truncate"
			: row.overflow === "truncate"
				? "truncate"
				: strategy;

	if (effectiveStrategy === "compact-hide-truncate") compactSegments(all());
	if (effectiveStrategy === "truncate") truncateOptional(all(), measure, width);

	// Preserve the configured two-sided structure while hiding: removing the
	// last Segment of an initially non-empty group would turn a left/right row
	// into a single-group row. Prefer truncating both sides over dropping an
	// entire side (e.g. a long project path must truncate, not vanish, when
	// the model name is also long). Emptying a group remains allowed as the
	// final fallback when even truncated content cannot fit.
	const twoSided = left.length > 0 && right.length > 0;
	while (measure() > width) {
		const optional = all()
			.filter((segment) => !segment.required)
			.sort((leftSegment, rightSegment) => leftSegment.priority - rightSegment.priority);
		const next = optional.find(
			(candidate) => !wouldEmptyGroup(candidate, fittedLeft, fittedRight, twoSided),
		);
		if (!next) break;
		removeSegment(next, fittedLeft, fittedRight);
		hidden.push(next.id);
	}

	if (measure() > width) {
		compactSegments(all());
	}
	if (measure() > width) truncateOptional(all(), measure, width);
	if (measure() > width) truncateRequired(all(), measure, width);

	// Final fallback per spec: render required Segments only. Only here may
	// hiding empty an initially non-empty group, when truncation alone cannot
	// fit the terminal width.
	while (measure() > width) {
		const optional = all()
			.filter((segment) => !segment.required)
			.sort((leftSegment, rightSegment) => leftSegment.priority - rightSegment.priority);
		const next = optional[0];
		if (!next) break;
		removeSegment(next, fittedLeft, fittedRight);
		hidden.push(next.id);
	}
	if (measure() > width) truncateRequired(all(), measure, width);

	return { left: fittedLeft, right: fittedRight, hidden };
}

export function measureGroups(
	left: readonly LayoutSegment[],
	right: readonly LayoutSegment[],
	separator: string,
): number {
	return (
		groupWidth(left, separator) +
		groupWidth(right, separator) +
		(left.length > 0 && right.length > 0 ? 1 : 0)
	);
}

function groupWidth(segments: readonly LayoutSegment[], separator: string): number {
	if (segments.length === 0) return 0;
	return (
		segments.reduce((total, segment) => total + visibleWidth(segment.text), 0) +
		Math.max(0, segments.length - 1) * visibleWidth(separator)
	);
}

function truncateOptional(segments: LayoutSegment[], measure: () => number, width: number): void {
	truncateByPriority(
		segments.filter((segment) => !segment.required),
		measure,
		width,
	);
}

function truncateRequired(segments: LayoutSegment[], measure: () => number, width: number): void {
	truncateByPriority(
		segments.filter((segment) => segment.required),
		measure,
		width,
	);
	if (measure() <= width) return;
	for (const segment of segments) {
		if (measure() <= width) break;
		segment.text = stripTerminalSequences(
			truncateToWidth(
				segment.text,
				Math.max(1, visibleWidth(segment.text) - (measure() - width)),
				"…",
			),
		);
	}
}

function truncateByPriority(segments: LayoutSegment[], measure: () => number, width: number): void {
	for (const segment of segments.sort((left, right) => left.priority - right.priority)) {
		if (measure() <= width) break;
		const currentWidth = visibleWidth(segment.text);
		const overflow = measure() - width;
		const targetWidth = Math.max(1, currentWidth - overflow);
		if (targetWidth < currentWidth) truncateSegment(segment, targetWidth);
	}
}

function wouldEmptyGroup(
	segment: LayoutSegment,
	left: readonly LayoutSegment[],
	right: readonly LayoutSegment[],
	twoSided: boolean,
): boolean {
	if (!twoSided) return false;
	if (left.includes(segment)) return left.length === 1 && right.length > 0;
	if (right.includes(segment)) return right.length === 1 && left.length > 0;
	return false;
}

function removeSegment(
	segment: LayoutSegment,
	left: LayoutSegment[],
	right: LayoutSegment[],
): void {
	const leftIndex = left.indexOf(segment);
	if (leftIndex >= 0) {
		left.splice(leftIndex, 1);
		return;
	}
	const rightIndex = right.indexOf(segment);
	if (rightIndex >= 0) right.splice(rightIndex, 1);
}

function cloneSegment(segment: LayoutSegment): LayoutSegment {
	return { ...segment };
}
