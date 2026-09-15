import { describe, expect, it } from "vitest";
import type { ProviderUsageSnapshot } from "../src/state/types.js";
import { formatQuotaLine, STRIP_KEY } from "../src/strip.js";

const snapshot = (over: Partial<ProviderUsageSnapshot> = {}): ProviderUsageSnapshot => ({
	provider: "openai-codex",
	state: "fresh",
	fetchedAt: 1_000_000,
	windows: [
		{ id: "5h", label: "5h", usedPercent: 64, resetAt: 1_000_000 + 2 * 3_600_000, state: "normal" },
	],
	...over,
});

describe("formatQuotaLine", () => {
	it("renders windows in the footer's vocabulary", () => {
		expect(formatQuotaLine(snapshot())).toBe("Codex 5hr 64% (reset 2h)");
	});

	it("joins several windows and marks stale readings", () => {
		const line = formatQuotaLine(
			snapshot({
				state: "stale",
				windows: [
					{ id: "5h", label: "5h", usedPercent: 64, state: "normal" },
					{ id: "week", label: "7d", usedPercent: 12, state: "normal" },
				],
			}),
		);
		expect(line).toBe("Codex 5hr 64% · 7d 12% · stale");
	});

	it("clears the line when there is nothing worth showing", () => {
		expect(formatQuotaLine(undefined)).toBeUndefined();
		expect(formatQuotaLine(snapshot({ state: "unavailable" }))).toBeUndefined();
		expect(formatQuotaLine(snapshot({ state: "error" }))).toBeUndefined();
		expect(formatQuotaLine(snapshot({ windows: [] }))).toBeUndefined();
		expect(formatQuotaLine(snapshot({ state: "loading", windows: [] }))).toBeUndefined();
	});

	it("shows a dash while the first fetch is in flight", () => {
		expect(
			formatQuotaLine(
				snapshot({ state: "loading", windows: [{ id: "5h", label: "5h", state: "unknown" }] }),
			),
		).toBe("Codex 5hr —");
	});

	it("uses a stable strip key", () => {
		expect(STRIP_KEY).toBe("quota");
	});
});
