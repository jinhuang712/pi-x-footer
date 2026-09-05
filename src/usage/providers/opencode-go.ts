import { fetchUsageJson, isOfficialUsageOrigin, opencodeUsageUrl } from "../http.js";
import { normalizeOpenCodeUsage } from "../normalize.js";
import { canonicalProviderId } from "../provider-id.js";
import type { UsageProviderAdapter } from "../types.js";

export function createOpenCodeGoUsageAdapter(): UsageProviderAdapter {
	return {
		id: "opencode-go",
		displayName: "OpenCode Go",
		matches(input) {
			return (
				canonicalProviderId(input.provider) === "opencode-go" &&
				isOfficialUsageOrigin("opencode-go", input.baseUrl)
			);
		},
		async query(input) {
			const url = opencodeUsageUrl(input.auth.baseUrl);
			const payload = await fetchUsageJson(
				url,
				input.auth,
				input.signal,
				input.timeoutMs,
				input.fetch,
			);
			return normalizeOpenCodeUsage(payload, input.now?.() ?? Date.now());
		},
	};
}
