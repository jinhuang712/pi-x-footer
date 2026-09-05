import { CODEX_USAGE_URL, fetchUsageJson, isOfficialUsageOrigin } from "../http.js";
import { normalizeCodexUsage } from "../normalize.js";
import { canonicalProviderId } from "../provider-id.js";
import type { UsageProviderAdapter } from "../types.js";

export function createCodexUsageAdapter(): UsageProviderAdapter {
	return {
		id: "openai-codex",
		displayName: "OpenAI Codex",
		matches(input) {
			return (
				canonicalProviderId(input.provider) === "openai-codex" &&
				isOfficialUsageOrigin("openai-codex", input.baseUrl)
			);
		},
		async query(input) {
			if (!isOfficialUsageOrigin("openai-codex", input.auth.baseUrl)) {
				throw new Error("Codex usage requires the official chatgpt.com origin.");
			}
			const payload = await fetchUsageJson(
				CODEX_USAGE_URL,
				input.auth,
				input.signal,
				input.timeoutMs,
				input.fetch,
			);
			return normalizeCodexUsage(payload, input.now?.() ?? Date.now());
		},
	};
}
