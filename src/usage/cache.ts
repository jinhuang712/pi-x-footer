import type { ProviderUsageSnapshot } from "../state/types.js";

export interface UsageCacheEntry {
	key: string;
	snapshot: ProviderUsageSnapshot;
	fetchedAt: number;
	expiresAt: number;
	lastError?: string;
}

export class UsageCache {
	private readonly entries = new Map<string, UsageCacheEntry>();
	private readonly maxEntries: number;

	constructor(maxEntries = 16) {
		if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
			throw new Error("Usage cache size must be a positive integer.");
		}
		this.maxEntries = maxEntries;
	}

	get(key: string): UsageCacheEntry | undefined {
		return this.entries.get(key);
	}

	set(entry: UsageCacheEntry): void {
		this.entries.delete(entry.key);
		while (this.entries.size >= this.maxEntries) {
			const oldest = this.entries.keys().next().value;
			if (oldest === undefined) break;
			this.entries.delete(oldest);
		}
		this.entries.set(entry.key, {
			...entry,
			snapshot: {
				...entry.snapshot,
				windows: entry.snapshot.windows.map((window) => ({ ...window })),
			},
		});
	}

	clear(): void {
		this.entries.clear();
	}
}

export function usageCacheKey(provider: string, fingerprint: string, model?: string): string {
	return `${provider}:${fingerprint}:${model ?? ""}`;
}
