import type { FooterStore } from "../state/store.js";
import type {
	CacheUsageSnapshot,
	ContextUsageSnapshot,
	ConversationSnapshot,
	CostUsageSnapshot,
	TokenUsageSnapshot,
} from "../state/types.js";

export interface ContextUsageLike {
	tokens: number | null;
	contextWindow: number;
	percent: number | null;
}

export interface ConversationDataContext {
	getContextUsage(): ContextUsageLike | undefined;
	sessionManager: {
		getEntries(): readonly unknown[];
	};
	model?: {
		contextWindow?: number;
	};
}

interface UsageLike {
	input?: unknown;
	output?: unknown;
	cacheRead?: unknown;
	cacheWrite?: unknown;
	totalTokens?: unknown;
	cost?: {
		input?: unknown;
		output?: unknown;
		cacheRead?: unknown;
		cacheWrite?: unknown;
		total?: unknown;
	};
}

export interface ConversationUsageSummary {
	hasUsage: boolean;
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: CostUsageSnapshot;
	latestCacheHitRate?: number;
}

export interface ConversationDataSource {
	sessionStart(context: ConversationDataContext): void;
	refresh(context: ConversationDataContext): void;
}

export function createConversationDataSource(store: FooterStore): ConversationDataSource {
	return {
		sessionStart(context) {
			store.update({ conversation: undefined });
			this.refresh(context);
		},
		refresh(context) {
			store.update({ conversation: conversationSnapshotFromContext(context) });
		},
	};
}

export function conversationSnapshotFromContext(
	context: ConversationDataContext,
): ConversationSnapshot {
	const usage = summarizeSessionUsage(context.sessionManager.getEntries());
	const conversation: ConversationSnapshot = {};
	const contextUsage = contextSnapshotFromContext(context);
	if (contextUsage) conversation.context = contextUsage;

	if (usage.hasUsage) {
		conversation.tokens = tokenSnapshotFromSummary(usage);
		conversation.cache = cacheSnapshotFromSummary(usage);
		conversation.cost = costSnapshotFromSummary(usage);
	}

	return conversation;
}

export function summarizeSessionUsage(entries: readonly unknown[]): ConversationUsageSummary {
	const totals: ConversationUsageSummary = {
		hasUsage: false,
		input: 0,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 0,
		cost: { total: 0 },
	};
	let costBreakdownComplete = true;

	for (const entry of entries) {
		const usage = usageFromEntry(entry);
		if (!usage) continue;
		totals.hasUsage = true;
		totals.input += nonNegativeNumber(usage.input);
		totals.output += nonNegativeNumber(usage.output);
		totals.cacheRead += nonNegativeNumber(usage.cacheRead);
		totals.cacheWrite += nonNegativeNumber(usage.cacheWrite);
		totals.totalTokens +=
			usage.totalTokens !== undefined
				? nonNegativeNumber(usage.totalTokens)
				: nonNegativeNumber(usage.input) +
					nonNegativeNumber(usage.output) +
					nonNegativeNumber(usage.cacheRead) +
					nonNegativeNumber(usage.cacheWrite);
		const entryCost = costFromUsage(usage);
		if (!entryCost) {
			costBreakdownComplete = false;
		} else {
			totals.cost.total = roundCost((totals.cost.total ?? 0) + (entryCost.total ?? 0));
			const components = ["input", "output", "cacheRead", "cacheWrite"] as const;
			if (components.every((component) => entryCost[component] !== undefined)) {
				for (const component of components) {
					totals.cost[component] = roundCost(
						(totals.cost[component] ?? 0) + (entryCost[component] ?? 0),
					);
				}
			} else {
				costBreakdownComplete = false;
			}
		}

		if (isAssistantEntry(entry)) {
			const promptTokens =
				nonNegativeNumber(usage.input) +
				nonNegativeNumber(usage.cacheRead) +
				nonNegativeNumber(usage.cacheWrite);
			totals.latestCacheHitRate =
				promptTokens > 0 && nonNegativeNumber(usage.cacheRead) > 0
					? (nonNegativeNumber(usage.cacheRead) / promptTokens) * 100
					: undefined;
		}
	}

	if (!costBreakdownComplete) {
		delete totals.cost.input;
		delete totals.cost.output;
		delete totals.cost.cacheRead;
		delete totals.cost.cacheWrite;
	}
	return totals;
}

function contextSnapshotFromContext(
	context: ConversationDataContext,
): ContextUsageSnapshot | undefined {
	const usage = context.getContextUsage();
	if (!usage) return undefined;
	const contextWindow =
		positiveNumber(usage.contextWindow) ?? positiveNumber(context.model?.contextWindow);
	const usedTokens = finiteNumber(usage.tokens);
	const reportedPercent = finiteNumber(usage.percent);
	const usedPercent =
		reportedPercent ??
		(usedTokens !== undefined && contextWindow !== undefined
			? (usedTokens / contextWindow) * 100
			: undefined);

	if (usedTokens === undefined && contextWindow === undefined && usedPercent === undefined)
		return undefined;
	return {
		...(usedTokens === undefined ? {} : { usedTokens }),
		...(contextWindow === undefined ? {} : { limitTokens: contextWindow }),
		...(usedPercent === undefined ? {} : { usedPercent }),
	};
}

function tokenSnapshotFromSummary(summary: ConversationUsageSummary): TokenUsageSnapshot {
	return {
		input: summary.input,
		output: summary.output,
		total: summary.totalTokens,
	};
}

function cacheSnapshotFromSummary(summary: ConversationUsageSummary): CacheUsageSnapshot {
	const hasCacheData = summary.cacheRead > 0 || summary.cacheWrite > 0;
	return {
		read: summary.cacheRead,
		write: summary.cacheWrite,
		...(summary.latestCacheHitRate === undefined ? {} : { hitPercent: summary.latestCacheHitRate }),
		state: hasCacheData ? (summary.cacheRead > 0 ? "hit" : "miss") : "unavailable",
	};
}

function costSnapshotFromSummary(summary: ConversationUsageSummary): CostUsageSnapshot {
	return summary.cost;
}

function usageFromEntry(entry: unknown): UsageLike | undefined {
	if (!isRecord(entry)) return undefined;
	if (entry.type === "message" && isRecord(entry.message)) {
		if (entry.message.role !== "assistant" && entry.message.role !== "toolResult") return undefined;
		return isRecord(entry.message.usage) ? entry.message.usage : undefined;
	}
	if ((entry.type === "compaction" || entry.type === "branch_summary") && isRecord(entry.usage)) {
		return entry.usage;
	}
	return undefined;
}

function isAssistantEntry(entry: unknown): boolean {
	return (
		isRecord(entry) &&
		entry.type === "message" &&
		isRecord(entry.message) &&
		entry.message.role === "assistant"
	);
}

function costFromUsage(usage: UsageLike): CostUsageSnapshot | undefined {
	if (!isRecord(usage.cost)) return undefined;
	return {
		total: nonNegativeNumber(usage.cost.total),
		...(optionalNonNegativeNumber(usage.cost.input) === undefined
			? {}
			: { input: optionalNonNegativeNumber(usage.cost.input) }),
		...(optionalNonNegativeNumber(usage.cost.output) === undefined
			? {}
			: { output: optionalNonNegativeNumber(usage.cost.output) }),
		...(optionalNonNegativeNumber(usage.cost.cacheRead) === undefined
			? {}
			: { cacheRead: optionalNonNegativeNumber(usage.cost.cacheRead) }),
		...(optionalNonNegativeNumber(usage.cost.cacheWrite) === undefined
			? {}
			: { cacheWrite: optionalNonNegativeNumber(usage.cost.cacheWrite) }),
	};
}

function nonNegativeNumber(value: unknown): number {
	const number = finiteNumber(value);
	return number !== undefined && number >= 0 ? number : 0;
}

function optionalNonNegativeNumber(value: unknown): number | undefined {
	const number = finiteNumber(value);
	return number !== undefined && number >= 0 ? number : undefined;
}

function roundCost(value: number): number {
	return Math.round(value * 1e12) / 1e12;
}

function positiveNumber(value: unknown): number | undefined {
	const number = finiteNumber(value);
	return number !== undefined && number > 0 ? number : undefined;
}

function finiteNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
