export function formatCount(value: number | undefined): string {
	if (value === undefined || !Number.isFinite(value)) return "?";
	const absolute = Math.abs(value);
	if (absolute < 1000) return `${Math.round(value)}`;
	if (absolute < 10_000) return `${(value / 1000).toFixed(1)}k`;
	if (absolute < 1_000_000) return `${Math.round(value / 1000)}k`;
	return `${(value / 1_000_000).toFixed(1)}m`;
}

export function formatPercent(value: number | undefined, precision = 1): string {
	return value === undefined || !Number.isFinite(value) ? "?" : `${value.toFixed(precision)}%`;
}

export function formatCost(value: number | undefined, currency = "$"): string {
	if (value === undefined || !Number.isFinite(value)) return "?";
	return `${currency}${value.toFixed(value >= 1 ? 2 : 3)}`;
}

export function sanitizeSegmentText(value: string): string {
	const withoutControls = [...value]
		.map((character) => {
			const code = character.codePointAt(0) ?? 0;
			return code < 0x20 || code === 0x7f ? " " : character;
		})
		.join("");
	return withoutControls.replace(/\s+/gu, " ").trim();
}

export function compactPath(path: string, detailed: boolean): string {
	const normalized = path.replaceAll("\\", "/");
	if (detailed) return normalized || ".";
	const parts = normalized.split("/").filter(Boolean);
	return parts.at(-1) ?? (normalized || ".");
}
