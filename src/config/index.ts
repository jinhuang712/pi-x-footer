export {
	createCustomDefaultConfig,
	createDefaultConfig,
	createPresetSegmentConfig,
	DEFAULT_FOOTER_CONFIG,
	layoutForPreset,
	PRESET_LAYOUTS,
	SEGMENT_DEFAULTS,
} from "./defaults.js";
export type { LayoutReorderDirection, LayoutSegmentPosition, LayoutSide } from "./layout.js";
export {
	cleanLayoutRows,
	layoutPositions,
	moveLayoutSegment,
	reorderLayoutSegment,
	setLayoutSegmentSide,
} from "./layout.js";
export {
	CONFIG_FILE_NAME,
	configFilePath,
	loadConfig,
	projectConfigFilePath,
	serializeConfig,
} from "./loader.js";
export { mergeFooterConfig } from "./merge.js";
export { saveConfig, saveConfigDocument } from "./persistence.js";
export { normalizeConfig } from "./schema.js";
export type * from "./types.js";
