import { describe, expect, it } from "vitest";
import {
	type ConversationDataContext,
	conversationSnapshotFromContext,
	createConversationDataSource,
	summarizeSessionUsage,
} from "../src/data/conversation.js";
import { createFooterStore } from "../src/state/store.js";

const contextWith = (
	entries: readonly unknown[],
	contextUsage: ConversationDataContext["getContextUsage"] extends () => infer T ? T : never,
): ConversationDataContext => ({
	sessionManager: { getEntries: () => entries },
	getContextUsage: () => contextUsage,
	model: { contextWindow: 200_000 },
});

describe("summarizeSessionUsage", () => {
	it("aggregates assistant, tool, compaction, and branch summary usage", () => {
		const summary = summarizeSessionUsage([
			{
				type: "message",
				message: {
					role: "assistant",
					usage: {
						input: 100,
						output: 20,
						cacheRead: 80,
						cacheWrite: 10,
						totalTokens: 210,
						cost: { input: 0.004, output: 0.01, cacheRead: 0.005, cacheWrite: 0.001, total: 0.02 },
					},
				},
			},
			{
				type: "message",
				message: {
					role: "toolResult",
					usage: {
						input: 10,
						output: 5,
						cacheRead: 0,
						cacheWrite: 0,
						totalTokens: 15,
						cost: { input: 0.002, output: 0.005, cacheRead: 0, cacheWrite: 0.003, total: 0.01 },
					},
				},
			},
			{
				type: "compaction",
				usage: {
					input: 40,
					output: 10,
					totalTokens: 50,
					cost: { input: 0.006, output: 0.015, cacheRead: 0.008, cacheWrite: 0.001, total: 0.03 },
				},
			},
			{
				type: "branch_summary",
				usage: {
					input: 5,
					output: 2,
					totalTokens: 7,
					cost: { input: 0.001, output: 0.002, cacheRead: 0.001, cacheWrite: 0, total: 0.004 },
				},
			},
		]);

		expect(summary).toEqual({
			hasUsage: true,
			input: 155,
			output: 37,
			cacheRead: 80,
			cacheWrite: 10,
			totalTokens: 282,
			cost: {
				input: 0.013,
				output: 0.032,
				cacheRead: 0.014,
				cacheWrite: 0.005,
				total: 0.064,
			},
			latestCacheHitRate: (80 / 190) * 100,
		});
	});

	it("ignores unsupported entries and sanitizes invalid numeric values", () => {
		const summary = summarizeSessionUsage([
			{ type: "message", message: { role: "user", usage: { input: 100 } } },
			{ type: "unknown", usage: { input: 100 } },
			{ type: "message", message: { role: "assistant", usage: { input: -2, output: "bad" } } },
		]);

		expect(summary).toMatchObject({
			hasUsage: true,
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { total: 0 },
		});
	});
});

describe("conversationSnapshotFromContext", () => {
	it("normalizes context, token, cache, and cost data", () => {
		const snapshot = conversationSnapshotFromContext(
			contextWith(
				[
					{
						type: "message",
						message: {
							role: "assistant",
							usage: {
								input: 1_000,
								output: 200,
								cacheRead: 800,
								cacheWrite: 100,
								totalTokens: 2_100,
								cost: {
									input: 0.0123,
									output: 0.0831,
									cacheRead: 0.025,
									cacheWrite: 0.003,
									total: 0.1234,
								},
							},
						},
					},
				],
				{ tokens: 50_000, contextWindow: 200_000, percent: 25 },
			),
		);

		expect(snapshot).toEqual({
			context: { usedTokens: 50_000, limitTokens: 200_000, usedPercent: 25 },
			tokens: { input: 1_000, output: 200, total: 2_100 },
			cache: { read: 800, write: 100, hitPercent: (800 / 1_900) * 100, state: "hit" },
			cost: {
				input: 0.0123,
				output: 0.0831,
				cacheRead: 0.025,
				cacheWrite: 0.003,
				total: 0.1234,
			},
		});
	});

	it("falls back to total cost when component costs are unavailable", () => {
		const snapshot = conversationSnapshotFromContext(
			contextWith(
				[
					{
						type: "message",
						message: { role: "assistant", usage: { input: 10, cost: { total: 0.01 } } },
					},
				],
				undefined,
			),
		);
		expect(snapshot.cost).toEqual({ total: 0.01 });
	});

	it("calculates context percent when Pi reports tokens but no percent", () => {
		const snapshot = conversationSnapshotFromContext(
			contextWith([], {
				tokens: 75,
				contextWindow: 300,
				percent: null,
			}),
		);
		expect(snapshot.context).toEqual({ usedTokens: 75, limitTokens: 300, usedPercent: 25 });
		expect(snapshot.tokens).toBeUndefined();
	});

	it("marks cache as miss when only writes are reported", () => {
		const snapshot = conversationSnapshotFromContext(
			contextWith(
				[{ type: "message", message: { role: "assistant", usage: { cacheWrite: 10 } } }],
				undefined,
			),
		);
		expect(snapshot.cache).toEqual({ read: 0, write: 10, state: "miss" });
	});

	it("does not create usage fields for an empty session", () => {
		const snapshot = conversationSnapshotFromContext(contextWith([], undefined));
		expect(snapshot).toEqual({});
	});
});

describe("ConversationDataSource", () => {
	it("clears previous session usage before refreshing the new session", () => {
		const store = createFooterStore();
		const source = createConversationDataSource(store);
		const first = contextWith(
			[{ type: "message", message: { role: "assistant", usage: { input: 10 } } }],
			undefined,
		);
		source.sessionStart(first);
		expect(store.getSnapshot().conversation.tokens?.input).toBe(10);

		const second = contextWith([], undefined);
		source.sessionStart(second);
		expect(store.getSnapshot().conversation).toEqual({});
	});
});
