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

	while (measure() > width) {
		const optional = all()
			.filter((segment) => !segment.required)
			.sort((leftSegment, rightSegment) => leftSegment.priority - rightSegment.priority);
		const next = optional[0];
		if (!next) break;
		removeSegment(next, fittedLeft, fittedRight);
		hidden.push(next.id);
	}

	if (measure() > width) {
		compactSegments(all());
	}
	if (measure() > width) truncateOptional(all(), measure, width);
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
