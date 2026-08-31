import type { FooterRowConfig, SegmentId } from "./types.js";

/**
 * Return the persisted form of a layout.
 *
 * Empty rows are useful as temporary targets in the layout editor, but they
 * have no renderable meaning and must not survive a confirmed edit. A Segment
 * is also a placement, not a copy: keeping only its first reference prevents
 * malformed or interrupted edits from rendering the same Segment twice.
 */
export type LayoutSide = "left" | "right";
export type LayoutReorderDirection = "left" | "right";

export interface LayoutSegmentPosition {
	id: SegmentId;
	rowId: string;
	side: LayoutSide;
}

export function cleanLayoutRows(rows: readonly FooterRowConfig[]): FooterRowConfig[] {
	const seen = new Set<SegmentId>();
	const cleaned: FooterRowConfig[] = [];

	for (const row of rows) {
		const left = uniqueReferences(row.left, seen);
		const right = uniqueReferences(row.right, seen);
		if (left.length === 0 && right.length === 0) continue;
		cleaned.push({ ...structuredClone(row), left, right });
	}

	return cleaned;
}

/** Return every persisted Segment placement using stable Row ids, not array indexes. */
export function layoutPositions(rows: readonly FooterRowConfig[]): LayoutSegmentPosition[] {
	const positions: LayoutSegmentPosition[] = [];
	for (const row of rows) {
		for (const id of row.left) positions.push({ id, rowId: row.id, side: "left" });
		for (const id of row.right) positions.push({ id, rowId: row.id, side: "right" });
	}
	return positions;
}

/** Move a Segment to a Row and group without mutating the input layout. */
export function moveLayoutSegment(
	rows: readonly FooterRowConfig[],
	id: SegmentId,
	targetRowId: string,
	side: LayoutSide,
): FooterRowConfig[] {
	const source = findSegmentPosition(rows, id);
	const target = rows.find((row) => row.id === targetRowId);
	if (!source || !target) return structuredClone([...rows]);
	if (source.rowId === targetRowId && source.side === side) return structuredClone([...rows]);

	const nextRows = structuredClone([...rows]);
	removeSegment(nextRows, id);
	const nextTarget = nextRows.find((row) => row.id === targetRowId);
	if (!nextTarget) return nextRows;
	nextTarget[side].push(id);
	return cleanLayoutRows(nextRows);
}

/** Align a Segment to the other group in its current Row without mutation. */
export function setLayoutSegmentSide(
	rows: readonly FooterRowConfig[],
	id: SegmentId,
	side: LayoutSide,
): FooterRowConfig[] {
	const source = findSegmentPosition(rows, id);
	if (!source || source.side === side) return structuredClone([...rows]);

	const nextRows = structuredClone([...rows]);
	removeSegment(nextRows, id);
	const target = nextRows.find((row) => row.id === source.rowId);
	if (!target) return nextRows;
	target[side].push(id);
	return cleanLayoutRows(nextRows);
}

/** Reorder a Segment within its current group without mutating the input layout. */
export function reorderLayoutSegment(
	rows: readonly FooterRowConfig[],
	id: SegmentId,
	direction: LayoutReorderDirection,
): FooterRowConfig[] {
	const source = findSegmentPosition(rows, id);
	if (!source) return structuredClone([...rows]);
	const group = rows.find((row) => row.id === source.rowId)?.[source.side];
	if (!group) return structuredClone([...rows]);
	const currentIndex = group.indexOf(id);
	const targetIndex = currentIndex + (direction === "left" ? -1 : 1);
	if (currentIndex < 0 || targetIndex < 0 || targetIndex >= group.length) {
		return structuredClone([...rows]);
	}

	const nextRows = structuredClone([...rows]);
	const nextGroup = nextRows.find((row) => row.id === source.rowId)?.[source.side];
	if (!nextGroup) return nextRows;
	[nextGroup[currentIndex], nextGroup[targetIndex]] = [
		nextGroup[targetIndex],
		nextGroup[currentIndex],
	];
	return cleanLayoutRows(nextRows);
}

function findSegmentPosition(
	rows: readonly FooterRowConfig[],
	id: SegmentId,
): LayoutSegmentPosition | undefined {
	for (const row of rows) {
		if (row.left.includes(id)) return { id, rowId: row.id, side: "left" };
		if (row.right.includes(id)) return { id, rowId: row.id, side: "right" };
	}
	return undefined;
}

function removeSegment(rows: FooterRowConfig[], id: SegmentId): void {
	for (const row of rows) {
		row.left = row.left.filter((candidate) => candidate !== id);
		row.right = row.right.filter((candidate) => candidate !== id);
	}
}

function uniqueReferences(references: readonly SegmentId[], seen: Set<SegmentId>): SegmentId[] {
	const unique: SegmentId[] = [];
	for (const id of references) {
		if (seen.has(id)) continue;
		seen.add(id);
		unique.push(id);
	}
	return unique;
}
