import { UsageError } from "./errors.js";
import type { UsageAuth, UsageFetch } from "./types.js";

export const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
export const OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const MAX_RESPONSE_BYTES = 64 * 1024;

export function isOfficialUsageOrigin(provider: string, baseUrl: string | undefined): boolean {
	if (!baseUrl) return false;
	try {
		const url = new URL(baseUrl);
		if (url.username || url.password || url.search || url.hash) return false;
		if (provider === "openai-codex") return url.origin === "https://chatgpt.com";
		if (provider === "opencode-go") return url.origin === "https://opencode.ai";
		if (provider === "volcengine-agent-plan") {
			// Only the plan endpoint carries subscription quota; the generic
			// /api/v3 runtime is pay-as-you-go and has no usage bucket.
			return isOfficialArkOrigin(url, "/api/plan");
		}
		if (provider === "volcengine-coding-plan") {
			return isOfficialArkOrigin(url, "/api/coding");
		}
		return false;
	} catch {
		return false;
	}
}

function isOfficialArkOrigin(url: URL, pathPrefix: string): boolean {
	return url.origin === "https://ark.cn-beijing.volces.com" && url.pathname.startsWith(pathPrefix);
}

export function opencodeUsageUrl(baseUrl: string | undefined): string {
	if (!isOfficialUsageOrigin("opencode-go", baseUrl)) {
		throw new UsageError(
			"unsupported",
			"OpenCode Go usage requires the official opencode.ai origin.",
		);
	}
	// The GO plan serves quota from the versioned `/zen/go/v1` path even when
	// the model endpoint carries `/zen/go` or the bare origin; the other paths
	// return 404.
	return OPENCODE_GO_USAGE_URL;
}

export async function fetchUsageJson(
	url: string,
	auth: UsageAuth,
	signal: AbortSignal,
	timeoutMs: number,
	fetchImpl: UsageFetch = defaultFetch,
): Promise<Record<string, unknown>> {
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
		throw new UsageError("timeout", "Usage request timeout must be positive.");
	}
	const controller = new AbortController();
	let timedOut = false;
	const abort = () => controller.abort();
	if (signal.aborted) throw new UsageError("aborted", "Usage request aborted.");
	signal.addEventListener("abort", abort, { once: true });
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	try {
		const response = await fetchImpl(url, {
			method: "GET",
			headers: { ...auth.headers, "User-Agent": "pi-x-footer" },
			signal: controller.signal,
		});
		if (controller.signal.aborted) {
			throw new UsageError(
				timedOut ? "timeout" : "aborted",
				timedOut ? "Usage request timed out." : "Usage request aborted.",
			);
		}
		if (!response.ok) {
			throw new UsageError(
				response.status === 401 || response.status === 403 ? "unauthorized" : "network",
				`Usage endpoint returned HTTP ${response.status}.`,
			);
		}
		const text = await boundedText(response);
		if (controller.signal.aborted) throw new UsageError("aborted", "Usage request aborted.");
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			throw new UsageError("invalid-response", "Usage endpoint returned invalid JSON.");
		}
		if (!isRecord(parsed))
			throw new UsageError("invalid-response", "Usage endpoint returned an invalid object.");
		return parsed;
	} catch (error) {
		if (error instanceof UsageError) throw error;
		if (timedOut) throw new UsageError("timeout", "Usage request timed out.");
		if (signal.aborted) throw new UsageError("aborted", "Usage request aborted.");
		throw new UsageError("network", "Usage request failed.");
	} finally {
		clearTimeout(timer);
		signal.removeEventListener("abort", abort);
	}
}

async function boundedText(response: Response): Promise<string> {
	if (!response.body) {
		const text = await response.text();
		if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
			throw new UsageError("invalid-response", "Usage response was too large.");
		}
		return text;
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (total + value.byteLength > MAX_RESPONSE_BYTES) {
				await reader.cancel();
				throw new UsageError("invalid-response", "Usage response was too large.");
			}
			chunks.push(value);
			total += value.byteLength;
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

function defaultFetch(input: string, init?: RequestInit): Promise<Response> {
	return fetch(input, init);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
