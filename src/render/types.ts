import type { ThemeColor } from "@earendil-works/pi-coding-agent";
import type {
	ColorMode,
	ColorRole,
	FooterStyleConfig,
	IconMode,
	SegmentId,
} from "../config/types.js";
import type { SemanticState } from "../segments/types.js";

export type SemanticRole = ColorRole;

export type SemanticColorMap = Record<SemanticRole, ThemeColor>;

export interface ThemeLike {
	fg(color: ThemeColor, text: string): string;
	bold?(text: string): string;
	dim?(text: string): string;
	italic?(text: string): string;
}

export interface StyledTextPart {
	text: string;
	state?: SemanticState;
	role?: SemanticRole;
	output: string;
}

export interface StyledSegment {
	id: SegmentId;
	text: string;
	state?: SemanticState;
	icon?: string;
	parts: StyledTextPart[];
	output: string;
}

export type SegmentStyleConfig = Pick<FooterStyleConfig, "colorMode" | "icons" | "labelMode">;

export interface IconSet {
	mode: IconMode;
	forSegment(id: SegmentId): string | undefined;
}

export type { ColorMode, IconMode };
