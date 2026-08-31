import { createHmac, randomBytes } from "node:crypto";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { UsageError } from "./errors.js";
import { isOfficialUsageOrigin } from "./http.js";
import type { UsageAuth } from "./types.js";

const FINGERPRINT_SALT = randomBytes(32);

export async function resolveRuntimeUsageAuth(
	ctx: ExtensionContext,
	provider: string,
	_signal: AbortSignal,
): Promise<UsageAuth | undefined> {
	const model = ctx.model;
	if (!model || model.provider !== provider) return undefined;
	if (!isOfficialUsageOrigin(provider, model.baseUrl)) {
		throw new UsageError("unsupported", "Usage is disabled for custom or proxy provider origins.");
	}

	if (provider === "volcengine-agent-plan" || provider === "volcengine-coding-plan") {
		// Ark plan quotas live on the control plane and are authenticated by the
		// `arkcli` SSO login, not by the model's inference API key. No HTTP
		// credential is needed; the fingerprint only pins the plan origin.
		return {
			headers: {},
			baseUrl: model.baseUrl,
			fingerprint: fingerprintCliAuth(provider, model.baseUrl),
		};
	}

	const resolved = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!resolved.ok)
		throw new UsageError("auth", "The active provider authentication is unavailable.");
	if (resolved.baseUrl && !isOfficialUsageOrigin(provider, resolved.baseUrl)) {
		throw new UsageError("unsupported", "Usage is disabled for custom or proxy provider origins.");
	}

	const headers = copyHeaders(resolved.headers);
	if (!header(headers, "Authorization") && resolved.apiKey) {
		headers.Authorization = `Bearer ${resolved.apiKey}`;
	}
	if (!header(headers, "Authorization")) return undefined;
	const fingerprint = fingerprintAuth(provider, model.id, headers);
	return {
		...(resolved.apiKey ? { apiKey: resolved.apiKey } : {}),
		headers,
		baseUrl: model.baseUrl,
		fingerprint,
	};
}

function copyHeaders(value: Record<string, string | null> | undefined): Record<string, string> {
	const headers: Record<string, string> = {};
	for (const [name, raw] of Object.entries(value ?? {})) {
		if (typeof raw === "string" && raw.length > 0) headers[name] = raw;
	}
	return headers;
}

function header(headers: Record<string, string>, name: string): string | undefined {
	const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
	return found?.[1];
}

function fingerprintAuth(provider: string, model: string, headers: Record<string, string>): string {
	const canonical = Object.entries(headers)
		.map(([name, value]) => [name.toLowerCase(), value] as const)
		.sort(([left], [right]) => left.localeCompare(right));
	return createHmac("sha256", FINGERPRINT_SALT)
		.update(JSON.stringify({ provider, model, headers: canonical }))
		.digest("hex");
}

function fingerprintCliAuth(provider: string, baseUrl: string): string {
	return createHmac("sha256", FINGERPRINT_SALT)
		.update(JSON.stringify({ provider, baseUrl }))
		.digest("hex");
}
