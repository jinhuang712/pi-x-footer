export { createIconSet, iconForSegment } from "./icons.js";
export {
	prepareSegmentForLayout,
	segmentStatusMarker,
	styleSegment,
} from "./presentation.js";
export type { FooterComponentOptions, FooterTuiLike } from "./renderer.js";
export { createFooterComponent, FooterComponent } from "./renderer.js";
export {
	applySemanticColor,
	colorForRole,
	DEFAULT_SEMANTIC_COLORS,
	roleForState,
	styleSeparator,
} from "./theme.js";
export type {
	IconSet,
	SegmentStyleConfig,
	SemanticColorMap,
	SemanticRole,
	StyledSegment,
	StyledTextPart,
	ThemeLike,
} from "./types.js";
