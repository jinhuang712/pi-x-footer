import { describe, expect, it } from "vitest";
import {
	layoutPositions,
	moveLayoutSegment,
	reorderLayoutSegment,
	setLayoutSegmentSide,
} from "../src/config/layout.js";
import type { FooterRowConfig } from "../src/config/types.js";

const row = (
	id: string,
	left: FooterRowConfig["left"],
	right: FooterRowConfig["right"],
): FooterRowConfig => ({
	id,
	left,
	right,
	visible: "always",
	overflow: "hide",
});

describe("layout operations", () => {
	it("reports stable Row ids instead of positional indexes", () => {
		expect(
			layoutPositions([row("first", ["cwd"], ["identity"]), row("second", [], ["cost"])]),
		).toEqual([
			{ id: "cwd", rowId: "first", side: "left" },
			{ id: "identity", rowId: "first", side: "right" },
			{ id: "cost", rowId: "second", side: "right" },
		]);
	});

	it("moves a Segment by Row id and removes an empty source Row", () => {
		const rows = [row("source", [], ["cost"]), row("target", ["tokens"], [])];

		expect(moveLayoutSegment(rows, "cost", "target", "right")).toEqual([
			row("target", ["tokens"], ["cost"]),
		]);
		expect(rows).toEqual([row("source", [], ["cost"]), row("target", ["tokens"], [])]);
	});

	it("continues to address a moved Segment after the source Row disappears", () => {
		const rows = [
			row("source", [], ["cost"]),
			row("target", ["tokens"], []),
			row("final", ["cwd"], []),
		];
		const moved = moveLayoutSegment(rows, "cost", "target", "right");

		expect(moveLayoutSegment(moved, "cost", "final", "right")).toEqual([
			row("target", ["tokens"], []),
			row("final", ["cwd"], ["cost"]),
		]);
	});

	it("changes group and order without mutating the input", () => {
		const rows = [row("main", ["cwd", "git"], ["context"]), row("other", ["cost"], [])];

		expect(setLayoutSegmentSide(rows, "context", "left")).toEqual([
			row("main", ["cwd", "git", "context"], []),
			row("other", ["cost"], []),
		]);
		expect(reorderLayoutSegment(rows, "cwd", "right")).toEqual([
			row("main", ["git", "cwd"], ["context"]),
			row("other", ["cost"], []),
		]);
		expect(rows).toEqual([row("main", ["cwd", "git"], ["context"]), row("other", ["cost"], [])]);
	});
});
