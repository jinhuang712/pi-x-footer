import type { ProviderUsageSnapshot, UsageWindowSnapshot } from "../state/types.js";
import { UsageError } from "./errors.js";

export function normalizeCodexUsage(payload: unknown, now = Date.now()): ProviderUsageSnapshot {
	if (!isRecord(payload))
		throw new UsageError("invalid-response", "Codex usage response was not an object.");
	const windows: UsageWindowSnapshot[] = [];
	const primary = isRecord(payload.rate_limit) ? payload.rate_limit : undefined;
	addCodexGroup(windows, "codex", primary, now);
	if (Array.isArray(payload.additional_rate_limits)) {
		for (const [index, item] of payload.additional_rate_limits.entries()) {
			if (!isRecord(item)) continue;
			addCodexGroup(
				windows,
				`additional-${index + 1}`,
				isRecord(item.rate_limit) ? item.rate_limit : undefined,
				now,
			);
		}
	}
	if (windows.length === 0)
		throw new UsageError("invalid-response", "Codex usage response had no usage windows.");
	return { provider: "openai-codex", state: "fresh", fetchedAt: now, windows };
}

export function normalizeOpenCodeUsage(payload: unknown, now = Date.now()): ProviderUsageSnapshot {
	if (!isRecord(payload) || !isRecord(payload.usage)) {
		throw new UsageError("invalid-response", "OpenCode usage response was not an object.");
	}
	const windows: UsageWindowSnapshot[] = [];
	// OpenCode calls its short rolling quota "rolling"; expose the
	// equivalent normalized 5h window used by the Footer configuration.
	const definitions = [
		["rolling", "5h"],
		["weekly", "w"],
		["monthly", "m"],
	] as const;
	for (const [id, label] of definitions) {
		const value = isRecord(payload.usage[id]) ? payload.usage[id] : undefined;
		if (!value) continue;
		const status = asString(value.status);
		if (status !== "ok" && status !== "rate-limited") continue;
		const percent = asPercent(value.percent);
		if (percent === undefined) continue;
		const resetAt = asEpochMilliseconds(value.resetsAt);
		let state = stateForPercent(percent, resetAt, now);
		if (status === "rate-limited" && state === "normal") state = "warning";
		windows.push({
			id,
			label,
			usedPercent: percent,
			state,
			...(resetAt === undefined ? {} : { resetAt }),
		});
	}
	if (windows.length === 0) {
		throw new UsageError("invalid-response", "OpenCode usage response had no usage windows.");
	}
	return { provider: "opencode-go", state: "fresh", fetchedAt: now, windows };
}

export function normalizeArkAgentPlanUsage(
	payload: unknown,
	now = Date.now(),
): ProviderUsageSnapshot {
	return normalizeArkPlanUsage(
		payload,
		"volcengine-agent-plan",
		"agent-plan",
		[
			["5h", "5h"],
			["weekly", "w"],
			["monthly", "m"],
		],
		now,
	);
}

export function normalizeArkCodingPlanUsage(
	payload: unknown,
	now = Date.now(),
): ProviderUsageSnapshot {
	// CodingPlan names its short rolling window "session" and the backend only
	// returns a percent (no absolute used/total), so only percent is mapped.
	return normalizeArkPlanUsage(
		payload,
		"volcengine-coding-plan",
		"coding-plan",
		[
			["session", "5h"],
			["weekly", "w"],
			["monthly", "m"],
		],
		now,
	);
}

function normalizeArkPlanUsage(
	payload: unknown,
	provider: "volcengine-agent-plan" | "volcengine-coding-plan",
	productHint: string,
	definitions: readonly (readonly [string, string])[],
	now: number,
): ProviderUsageSnapshot {
	if (!isRecord(payload)) {
		throw new UsageError(
			"invalid-response",
			`Ark ${productHint} usage response was not an object.`,
		);
	}
	if (!Array.isArray(payload.items)) {
		throw new UsageError("invalid-response", `Ark ${productHint} usage response had no items.`);
	}
	const item = payload.items
		.map((candidate) => (isRecord(candidate) ? candidate : undefined))
		.find((candidate) => candidate !== undefined && candidate.subscribed === true);
	if (!item) {
		throw new UsageError("unsupported", `No active ${productHint} subscription was found.`);
	}
	const windows: UsageWindowSnapshot[] = [];
	const periods = Array.isArray(item.periods) ? item.periods : [];
	for (const [id, label] of definitions) {
		const period = periods.find((candidate) => isRecord(candidate) && candidate.label === id);
		if (!isRecord(period)) continue;
		const percent = asPercent(period.percent);
		if (percent === undefined) continue;
		const resetAt = asEpochMilliseconds(period.reset_at);
		windows.push({
			id,
			label,
			usedPercent: percent,
			state: stateForPercent(percent, resetAt, now),
			...(resetAt === undefined ? {} : { resetAt }),
		});
	}
	if (windows.length === 0) {
		throw new UsageError(
			"invalid-response",
			`Ark ${productHint} usage response had no usage windows.`,
		);
	}
	return { provider, state: "fresh", fetchedAt: now, windows };
}

function addCodexGroup(
	windows: UsageWindowSnapshot[],
	groupId: string,
	group: Record<string, unknown> | undefined,
	now: number,
): void {
	if (!group) return;
	for (const [position, key] of [
		["primary", "5h"],
		["secondary", "wk"],
	] as const) {
		const raw = group[`${position}_window`];
		const value = isRecord(raw) ? raw : undefined;
		if (!value) continue;
		const percent = asPercent(value.used_percent);
		if (percent === undefined) continue;
		const seconds = asNonnegativeNumber(value.limit_window_seconds);
		const label = key === "5h" && seconds !== undefined ? codexLabel(seconds) : key;
		const resetAt = asEpochMilliseconds(value.reset_at);
		windows.push({
			id: `${groupId}:${position}`,
			label,
			usedPercent: percent,
			state: stateForPercent(percent, resetAt, now),
			...(resetAt === undefined ? {} : { resetAt }),
		});
	}
}

function codexLabel(seconds: number): string {
	if (seconds >= 6 * 24 * 60 * 60) return "wk";
	if (seconds >= 60 * 60) return `${Math.max(1, Math.round(seconds / 3600))}h`;
	return `${Math.max(1, Math.round(seconds / 60))}m`;
}

function stateForPercent(
	percent: number,
	resetAt: number | undefined,
	now: number,
): UsageWindowSnapshot["state"] {
	if (resetAt !== undefined && resetAt <= now) return "expired";
	if (percent >= 90) return "error";
	if (percent >= 70) return "warning";
	return "normal";
}

function asPercent(value: unknown): number | undefined {
	return asNonnegativeNumber(value);
}

function asNonnegativeNumber(value: unknown): number | undefined {
	const number = typeof value === "string" && value.trim() ? Number(value) : value;
	return typeof number === "number" && Number.isFinite(number) && number >= 0 ? number : undefined;
}

function asEpochMilliseconds(value: unknown): number | undefined {
	if (typeof value === "string" && value.trim()) {
		const parsed = Date.parse(value);
		if (!Number.isNaN(parsed)) return parsed;
	}
	const number = asNonnegativeNumber(value);
	if (number === undefined) return undefined;
	return number < 1e12 ? number * 1000 : number;
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
