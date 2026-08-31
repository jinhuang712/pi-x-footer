import { cloneConfig } from "./defaults.js";
import type { FooterConfig, FooterLayoutConfig, SegmentConfigMap } from "./types.js";

export function mergeFooterConfig(
	base: FooterConfig,
	override: Partial<FooterConfig>,
): FooterConfig {
	const result = cloneConfig(base);

	if (override.version !== undefined) result.version = override.version;
	if (override.enabled !== undefined) result.enabled = override.enabled;
	if (override.preset !== undefined) result.preset = override.preset;
	if (override.layout !== undefined) result.layout = cloneLayout(override.layout);
	if (override.projectOverrides !== undefined) {
		result.projectOverrides = {
			...result.projectOverrides,
			...override.projectOverrides,
		};
	}
	if (override.style !== undefined) {
		result.style = {
			...result.style,
			...override.style,
		};
	}
	if (override.segments !== undefined) {
		result.segments = mergeSegmentConfigs(result.segments, override.segments);
	}
	if (override.thresholds !== undefined) {
		result.thresholds = {
			...result.thresholds,
			...override.thresholds,
			...(override.thresholds.context
				? { context: { ...result.thresholds.context, ...override.thresholds.context } }
				: {}),
			...(override.thresholds.providerUsage
				? {
						providerUsage: {
							...result.thresholds.providerUsage,
							...override.thresholds.providerUsage,
						},
					}
				: {}),
		};
	}
	if (override.responsive !== undefined) {
		result.responsive = { ...result.responsive, ...override.responsive };
	}
	if (override.usage !== undefined) {
		result.usage = {
			...result.usage,
			...override.usage,
			...(override.usage.providers ? { providers: [...override.usage.providers] } : {}),
			...(override.usage.windows ? { windows: [...override.usage.windows] } : {}),
		};
	}

	return result;
}

function cloneLayout(layout: FooterLayoutConfig): FooterLayoutConfig {
	return structuredClone(layout);
}

function mergeSegmentConfigs(
	base: FooterConfig["segments"],
	override: SegmentConfigMap | FooterConfig["segments"],
): FooterConfig["segments"] {
	const result = structuredClone(base);
	for (const [id, settings] of Object.entries(override)) {
		if (!settings) continue;
		const segmentId = id as keyof typeof result;
		if (!result[segmentId]) continue;
		result[segmentId] = {
			...result[segmentId],
			...settings,
			...(settings.maxWindows === undefined ? {} : { maxWindows: settings.maxWindows }),
		};
	}
	return result;
}
