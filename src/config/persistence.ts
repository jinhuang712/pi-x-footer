import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { serializeConfig } from "./loader.js";
import type { FooterConfig } from "./types.js";

export function saveConfigDocument(configPath: string, document: string): void {
	const directory = dirname(configPath);
	const temporaryPath = join(directory, `.${randomUUID()}.tmp`);
	mkdirSync(directory, { recursive: true });
	try {
		writeFileSync(temporaryPath, document, { encoding: "utf8", flag: "wx" });
		renameSync(temporaryPath, configPath);
	} finally {
		rmSync(temporaryPath, { force: true });
	}
}

export function saveConfig(configPath: string, config: FooterConfig): void {
	saveConfigDocument(configPath, serializeConfig(config));
}
