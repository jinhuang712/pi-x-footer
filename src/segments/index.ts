export { BUILTIN_SEGMENTS } from "./builtins.js";
export { formatCost, formatCount, formatPercent, sanitizeSegmentText } from "./format.js";
export type {
	SegmentConfigField,
	SegmentConfigFieldKey,
	SegmentConfigFieldKind,
	SegmentMetadata,
} from "./metadata.js";
export {
	SEGMENT_CONFIG_FIELDS,
	SEGMENT_METADATA,
	segmentConfigFields,
	segmentLabel,
	segmentMetadata,
	segmentPreview,
} from "./metadata.js";
export { createBuiltinSegmentRegistry, resolveSegments } from "./registry.js";
export type {
	FooterSegment,
	ResolvedSegment,
	SegmentContent,
	SegmentContentPart,
	SegmentRegistry,
	SegmentResolveContext,
	SemanticState,
} from "./types.js";
