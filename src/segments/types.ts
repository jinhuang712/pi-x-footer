import type {
	ColorRole,
	FooterConfig,
	SegmentFormat,
	SegmentId,
	UsageWindow,
} from "../config/types.js";
import type { FooterSnapshot } from "../state/types.js";
import type { SegmentConfigField } from "./metadata.js";

export type SemanticState = "normal" | "success" | "warning" | "error" | "muted" | "info";

export interface SegmentResolveContext {
	snapshot: FooterSnapshot;
	config: FooterConfig;
	format: SegmentFormat;
	label?: string;
	usageWindows?: readonly UsageWindow[];
	showUsageResets?: boolean;
	/** Curated per-Segment display preset. */
	display?: string;
	/** Optional content-specific notation. */
	notation?: string;
	contextThresholds?: { warning: number; error: number };
	providerUsageThresholds?: { warning: number; error: number };
}

export interface SegmentContentPart {
	text: string;
	state?: SemanticState;
	role?: ColorRole;
}

export interface SegmentContent {
	text: string;
	compactText?: string;
	state?: SemanticState;
	parts?: readonly SegmentContentPart[];
}

export interface FooterSegment {
	readonly id: SegmentId;
	readonly configFields: readonly SegmentConfigField[];
	resolve(context: SegmentResolveContext): SegmentContent | undefined;
}

export interface ResolvedSegment extends SegmentContent {
	id: SegmentId;
	priority: number;
	required: boolean;
	format?: SegmentFormat;
}

export interface SegmentRegistry {
	get(id: SegmentId): FooterSegment | undefined;
	values(): readonly FooterSegment[];
}
