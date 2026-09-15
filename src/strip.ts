import { formatResetDuration, providerUsageLabel, usageWindowLabel } from "./segments/builtins.js";
import { formatPercent } from "./segments/format.js";
import type { ProviderUsageSnapshot } from "./state/types.js";

/**
 * Quota as one strip line for non-terminal hosts.
 *
 * The TUI draws this same snapshot as a footer; a window has no footer, so the
 * extension publishes the same numbers as text and the host shows them above
 * the composer. Same vocabulary as the footer (labels, percents, resets), no
 * colors: the strip is plain lines.
 */

/** Strip key PID shows as one line above the composer. Plain key: the line is the payload. */
export const STRIP_KEY = "quota";

/**
 * One strip line for a quota snapshot, or undefined to clear the line.
 * Cleared when nothing was fetched, the fetch failed, or there are no windows:
 * a stale apology is worse than no line, and the next refresh republishes.
 */
export function formatQuotaLine(
	snapshot: ProviderUsageSnapshot | undefined,
	now = Date.now(),
): string | undefined {
	if (!snapshot) return undefined;
	if (snapshot.state === "unavailable" || snapshot.state === "error") return undefined;
	if (snapshot.state === "loading" && snapshot.windows.length === 0) return undefined;
	if (snapshot.windows.length === 0) return undefined;
	const from = snapshot.fetchedAt ?? now;
	const parts = snapshot.windows.map((window) => {
		const percent = snapshot.state === "loading" ? "—" : formatPercent(window.usedPercent, 0);
		const reset =
			window.resetAt !== undefined ? ` (reset ${formatResetDuration(window.resetAt - from)})` : "";
		return `${usageWindowLabel(window)} ${percent}${reset}`;
	});
	const stale = snapshot.state === "stale" ? " · stale" : "";
	return `${providerUsageLabel(snapshot.provider)} ${parts.join(" · ")}${stale}`;
}
