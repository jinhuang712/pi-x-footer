import type { FooterRowConfig } from "../config/types.js";
import type { ResolvedSegment } from "../segments/types.js";

export interface LayoutSegment extends ResolvedSegment {}

export interface LayoutRowResult {
	id: string;
	left: LayoutSegment[];
	right: LayoutSegment[];
	separator: string;
	line: string;
	width: number;
	hidden: string[];
}

export interface FooterLayoutResult {
	rows: LayoutRowResult[];
	lines: string[];
	hidden: string[];
}

export interface LayoutPlanRow {
	config: FooterRowConfig;
	left: LayoutSegment[];
	right: LayoutSegment[];
}
