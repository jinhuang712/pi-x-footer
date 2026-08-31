import type { ProviderUsageSnapshot } from "../../state/types.js";
import { UsageError } from "../errors.js";
import { isOfficialUsageOrigin } from "../http.js";
import type { UsageExecResult, UsageProviderAdapter } from "../types.js";

/**
 * The Ark plan quotas live on the Ark control plane, not on the inference
 * runtime, so both plan adapters shell out to the official `arkcli` CLI (SSO
 * authenticated) instead of an HTTP usage endpoint.
 */
export interface ArkPlanAdapterSpec {
	id: "volcengine-agent-plan" | "volcengine-coding-plan";
	displayName: string;
	product: string;
	normalize(payload: unknown, now: number): ProviderUsageSnapshot;
}

export function createArkPlanUsageAdapter(spec: ArkPlanAdapterSpec): UsageProviderAdapter {
	return {
		id: spec.id,
		displayName: spec.displayName,
		matches(input) {
			return input.provider === spec.id && isOfficialUsageOrigin(spec.id, input.baseUrl);
		},
		async query(input) {
			if (!isOfficialUsageOrigin(spec.id, input.auth.baseUrl)) {
				throw new UsageError(
					"unsupported",
					`Ark ${spec.product} usage requires the official ark.cn-beijing.volces.com endpoint.`,
				);
			}
			if (!input.exec) {
				throw new UsageError("unsupported", `Ark ${spec.product} usage requires the arkcli CLI.`);
			}
			let result: UsageExecResult;
			try {
				result = await input.exec(
					"arkcli",
					["usage", "plan", "--product", spec.product, "--format", "json"],
					{ timeout: input.timeoutMs, signal: input.signal },
				);
			} catch (error) {
				if (isAbortError(error) || input.signal.aborted) {
					throw new UsageError("aborted", `Ark ${spec.product} usage request aborted.`);
				}
				if (isMissingCommand(error)) {
					throw new UsageError(
						"unsupported",
						"arkcli is not installed; run `npm i -g @volcengine/ark-cli`.",
					);
				}
				throw new UsageError("network", `arkcli failed to query the ${spec.product} usage.`);
			}
			if (result.killed || input.signal.aborted) {
				throw new UsageError("aborted", `Ark ${spec.product} usage request aborted.`);
			}
			if (result.code !== 0) {
				throw new UsageError(
					arkcliAuthHint(result.stdout, result.stderr) ? "auth" : "network",
					`arkcli failed to query the ${spec.product} usage.`,
				);
			}
			const payload = parseArkcliJson(result.stdout);
			if (payload === undefined) {
				throw new UsageError("invalid-response", "arkcli returned invalid usage JSON.");
			}
			if (isRecord(payload) && payload.ok === false) {
				const message = isRecord(payload.error) ? asString(payload.error.message) : undefined;
				throw new UsageError(
					arkcliAuthHint(message ?? "") ? "auth" : "network",
					`arkcli could not resolve the ${spec.product} subscription.`,
				);
			}
			return spec.normalize(payload, input.now?.() ?? Date.now());
		},
	};
}

function parseArkcliJson(stdout: string): unknown {
	const start = stdout.indexOf("{");
	if (start < 0) return undefined;
	try {
		return JSON.parse(stdout.slice(start));
	} catch {
		return undefined;
	}
}

/** Recognize login/credential failures so the state degrades to "auth". */
function arkcliAuthHint(stdout: string, stderr = ""): boolean {
	const haystack = `${stdout}\n${stderr}`.toLowerCase();
	return (
		haystack.includes("not configured") ||
		haystack.includes("not logged in") ||
		haystack.includes("not login") ||
		haystack.includes("access denied")
	);
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

function isMissingCommand(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const message = error.message.toLowerCase();
	return (
		message.includes("enofile") ||
		message.includes("command not found") ||
		message.includes("spawn arkcli")
	);
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
