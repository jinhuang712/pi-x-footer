import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { cloneConfig } from "./defaults.js";
import { cleanLayoutRows } from "./layout.js";
import { normalizeConfig } from "./schema.js";
import type { ConfigDiagnostic, ConfigSource, FooterConfig, LoadedConfig } from "./types.js";

export const CONFIG_FILE_NAME = "pi-x-footer.json";

export interface LoadConfigOptions {
	agentDir?: string;
	projectRoot?: string;
}

export function configFilePath(agentDir = getAgentDir()): string {
	return join(agentDir, CONFIG_FILE_NAME);
}

export function projectConfigFilePath(projectRoot: string): string {
	return join(projectRoot, ".pi", CONFIG_FILE_NAME);
}

export function loadConfig(options: LoadConfigOptions = {}): LoadedConfig {
	const globalPath = configFilePath(options.agentDir);
	const globalDocument = readDocument(globalPath);
	const globalResult = normalizeDocument(globalDocument, cloneConfig());
	const diagnostics = [...globalResult.diagnostics];
	let config = globalResult.config;
	let source: ConfigSource = globalDocument.kind === "missing" ? "built-in" : "global";
	let projectPath: string | undefined;
	let projectRawDocument: string | undefined;

	if (
		options.projectRoot &&
		config.projectOverrides.enabled &&
		!hasErrors(globalResult.diagnostics)
	) {
		projectPath = projectConfigFilePath(options.projectRoot);
		const projectDocument = readDocument(projectPath);
		if (projectDocument.kind === "present") {
			projectRawDocument = projectDocument.raw;
			const projectResult = normalizeDocument(projectDocument, config);
			config = projectResult.config;
			diagnostics.push(...projectResult.diagnostics);
			source = "project";
		}
	}

	return {
		config,
		source,
		globalPath,
		...(projectPath ? { projectPath } : {}),
		...(globalDocument.kind === "present" ? { globalRawDocument: globalDocument.raw } : {}),
		...(projectRawDocument ? { projectRawDocument } : {}),
		diagnostics,
	};
}

export function serializeConfig(config: FooterConfig): string {
	const customDocument =
		config.preset === "custom"
			? { ...config, layout: { rows: cleanLayoutRows(config.layout.rows) } }
			: undefined;
	const document = customDocument ?? {
		version: config.version,
		enabled: config.enabled,
		preset: config.preset,
		projectOverrides: config.projectOverrides,
		style: {
			colorMode: config.style.colorMode,
			icons: config.style.icons,
			separator: config.style.separator,
			density: config.style.density,
		},
		thresholds: config.thresholds,
		responsive: config.responsive,
		usage: config.usage,
	};
	return `${JSON.stringify(document, null, "\t")}\n`;
}

function normalizeDocument(
	document: ReadDocument,
	base: FooterConfig,
): { config: FooterConfig; diagnostics: ConfigDiagnostic[] } {
	if (document.kind === "missing") return { config: base, diagnostics: [] };
	if (document.kind === "io-error") {
		return {
			config: base,
			diagnostics: [
				{
					severity: "error",
					code: "io",
					path: "",
					message: document.message,
				},
			],
		};
	}

	try {
		return normalizeConfig(JSON.parse(document.raw), base);
	} catch (error) {
		return {
			config: base,
			diagnostics: [
				{
					severity: "error",
					code: "parse",
					path: "",
					message: `Unable to parse JSON: ${errorMessage(error)}`,
				},
			],
		};
	}
}

function readDocument(path: string): ReadDocument {
	try {
		return { kind: "present", raw: readFileSync(path, "utf8") };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "missing" };
		return { kind: "io-error", message: `Unable to read ${path}: ${errorMessage(error)}` };
	}
}

function hasErrors(diagnostics: readonly ConfigDiagnostic[]): boolean {
	return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

type ReadDocument =
	| { kind: "missing" }
	| { kind: "present"; raw: string }
	| { kind: "io-error"; message: string };
