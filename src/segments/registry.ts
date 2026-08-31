import { SEGMENT_DEFAULTS } from "../config/defaults.js";
import type { FooterConfig, SegmentId } from "../config/types.js";
import { resolveSegmentFormat, SEGMENT_IDS } from "../config/types.js";
import type { FooterSnapshot } from "../state/types.js";
import { BUILTIN_SEGMENTS } from "./builtins.js";
import type { FooterSegment, ResolvedSegment, SegmentRegistry } from "./types.js";

export function createBuiltinSegmentRegistry(): SegmentRegistry {
	const segments = new Map<SegmentId, FooterSegment>(
		BUILTIN_SEGMENTS.map((segment) => [segment.id, segment]),
	);
	return {
		get(id) {
			return segments.get(id);
		},
		values() {
			return [...segments.values()];
		},
	};
}

export function resolveSegments(
	snapshot: FooterSnapshot,
	config: FooterConfig,
	references: readonly SegmentId[],
	registry: SegmentRegistry = createBuiltinSegmentRegistry(),
): ResolvedSegment[] {
	const resolved: ResolvedSegment[] = [];
	for (const id of references) {
		if (!isSegmentId(id)) continue;
		const settings = config.segments[id];
		if (!settings.enabled) continue;
		const segment = registry.get(id);
		if (!segment) continue;
		const format = resolveSegmentFormat(config.style.labelMode, config.preset);
		const resolveContext = {
			snapshot,
			config,
			format,
			label: settings.label,
			usageWindows: config.usage.windows,
			showUsageResets: config.usage.showResetTime,
			display: settings.display,
			notation: settings.notation,
			contextThresholds: config.thresholds.context,
			providerUsageThresholds: config.thresholds.providerUsage,
		};
		const content = segment.resolve(resolveContext);
		const compactContent = segment.resolve({ ...resolveContext, format: "compact" });
		if (!content || content.text.length === 0) continue;
		resolved.push({
			...content,
			...(compactContent?.text ? { compactText: compactContent.text } : {}),
			id,
			format,
			priority: SEGMENT_DEFAULTS[id].priority,
			required: SEGMENT_DEFAULTS[id].required,
		});
	}
	return resolved;
}

function isSegmentId(value: string): value is SegmentId {
	return (SEGMENT_IDS as readonly string[]).includes(value);
}
