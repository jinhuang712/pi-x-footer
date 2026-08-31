import type { FooterStyleConfig, SegmentId } from "../config/types.js";
import type { ResolvedSegment, SegmentContentPart, SemanticState } from "../segments/types.js";
import { createIconSet } from "./icons.js";
import { applySemanticColor, roleForState } from "./theme.js";
import type { SemanticRole, StyledSegment, StyledTextPart, ThemeLike } from "./types.js";

export interface SegmentPresentationOptions {
	addIcon?: boolean;
	addStatusMarker?: boolean;
}

type PresentationStyle = Pick<FooterStyleConfig, "colorMode" | "icons">;

export function styleSegment(
	segment: ResolvedSegment,
	style: PresentationStyle,
	theme?: ThemeLike,
	options: SegmentPresentationOptions = {},
): StyledSegment {
	const icon = options.addIcon === false ? undefined : iconForSegment(segment, style);
	const prefix = icon && !startsWithIcon(segment.text, icon) ? `${icon} ` : "";
	const suffix =
		options.addStatusMarker === false ? "" : monochromeSuffix(style.colorMode, segment.state);
	const sourceParts = matchingParts(segment);
	const parts = sourceParts
		? sourceParts.map((part, index) => {
				const text = `${index === 0 ? prefix : ""}${part.text}${monochromeSuffix(style.colorMode, part.state)}`;
				return makeStyledPart(text, part.state, part.role, style.colorMode, theme);
			})
		: [
				makeStyledPart(
					`${prefix}${segment.text}${suffix}`,
					segment.state,
					undefined,
					style.colorMode,
					theme,
				),
			];

	return {
		id: segment.id,
		text: parts.map((part) => part.text).join(""),
		state: segment.state,
		icon,
		parts,
		output: parts.map((part) => part.output).join(""),
	};
}

function matchingParts(segment: ResolvedSegment): readonly SegmentContentPart[] | undefined {
	if (!segment.parts || segment.parts.length === 0) return undefined;
	const joined = segment.parts.map((part) => part.text).join("");
	return joined === segment.text ? segment.parts : undefined;
}

function makeStyledPart(
	text: string,
	state: SemanticState | undefined,
	partRole: SemanticRole | undefined,
	colorMode: FooterStyleConfig["colorMode"],
	theme: ThemeLike | undefined,
): StyledTextPart {
	const role = partRole ?? (state ? roleForState(state) : "text");
	const styled = applySemanticColor(theme, colorMode, role, text);
	return { text, state, role, output: styled };
}

function monochromeSuffix(
	mode: FooterStyleConfig["colorMode"],
	state: SemanticState | undefined,
): string {
	if (mode !== "monochrome") return "";
	if (state === "error") return " !!";
	if (state === "warning") return " !";
	if (state === "muted") return " ?";
	return "";
}

export function prepareSegmentForLayout(
	segment: ResolvedSegment,
	style: PresentationStyle,
): ResolvedSegment {
	const icon = iconForSegment(segment, style);
	const prefix = icon && !startsWithIcon(segment.text, icon) ? `${icon} ` : "";
	const decorate = (text: string, state: SemanticState | undefined = segment.state): string =>
		`${prefix}${text}${monochromeSuffix(style.colorMode, state)}`;
	const parts = segment.parts?.map((part, index) => ({
		...part,
		text: `${index === 0 ? prefix : ""}${part.text}${monochromeSuffix(style.colorMode, part.state)}`,
	}));
	return {
		...segment,
		text: parts ? parts.map((part) => part.text).join("") : decorate(segment.text),
		...(segment.compactText === undefined ? {} : { compactText: decorate(segment.compactText) }),
		...(parts ? { parts } : {}),
	};
}

function iconForSegment(segment: ResolvedSegment, style: PresentationStyle): string | undefined {
	if (segment.format === "labeled" || segment.format === "detailed") {
		return undefined;
	}
	return style.icons === "off" ? undefined : createIconSet(style.icons).forSegment(segment.id);
}

function startsWithIcon(text: string, icon: string): boolean {
	return text === icon || text.startsWith(`${icon} `);
}

export function segmentStatusMarker(state: SemanticState | undefined): string {
	return monochromeSuffix("monochrome", state);
}

export type { SegmentId };
