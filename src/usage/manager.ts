import type { UsageCacheEntry } from "./cache.js";
import { UsageCache, usageCacheKey } from "./cache.js";
import { usageErrorCode } from "./errors.js";
import { canonicalProviderId } from "./provider-id.js";
import { createArkAgentPlanUsageAdapter } from "./providers/ark-agent-plan.js";
import { createArkCodingPlanUsageAdapter } from "./providers/ark-coding-plan.js";
import { createCodexUsageAdapter } from "./providers/codex.js";
import { createOpenCodeGoUsageAdapter } from "./providers/opencode-go.js";
import type {
	UsageManager,
	UsageManagerOptions,
	UsageProviderAdapter,
	UsageSessionContext,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 4 * 60_000;
const DEFAULT_DEBOUNCE_MS = 250;
const MIN_REFRESH_MS = 1_000;

export function createUsageManager(options: UsageManagerOptions): UsageManager {
	const store = options.store;
	const adapters = options.adapters ?? [
		createCodexUsageAdapter(),
		createOpenCodeGoUsageAdapter(),
		createArkAgentPlanUsageAdapter(),
		createArkCodingPlanUsageAdapter(),
	];
	const enabledProviders = new Set<string>(options.providers.map(canonicalProviderId));
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
	const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
	const now = options.now ?? Date.now;
	const cache = new UsageCache();
	let context: UsageSessionContext | undefined;
	let generation = 0;
	let requestId = 0;
	let interval: ReturnType<typeof setInterval> | undefined;
	let debounce: ReturnType<typeof setTimeout> | undefined;
	let abortController: AbortController | undefined;
	let inFlight: Promise<void> | undefined;

	const clearIntervalTimer = () => {
		if (interval === undefined) return;
		clearInterval(interval);
		interval = undefined;
	};

	const clearDebounce = () => {
		if (debounce === undefined) return;
		clearTimeout(debounce);
		debounce = undefined;
	};

	const abortRequest = () => {
		abortController?.abort();
		abortController = undefined;
		inFlight = undefined;
	};

	const startTimer = () => {
		clearIntervalTimer();
		const configured = options.refreshSeconds * 1000;
		const intervalMs = Math.max(
			MIN_REFRESH_MS,
			Number.isFinite(configured) ? configured : MIN_REFRESH_MS,
		);
		interval = setInterval(() => void refresh(), intervalMs);
	};

	const selectAdapter = (current: UsageSessionContext): UsageProviderAdapter | undefined => {
		const provider = canonicalProviderId(current.provider);
		if (!provider || !enabledProviders.has(provider)) return undefined;
		return adapters.find((adapter) => adapter.id === provider && adapter.matches(current));
	};

	const isCurrent = (currentGeneration: number, currentRequestId: number): boolean =>
		generation === currentGeneration && requestId === currentRequestId && context !== undefined;

	const publishUnavailable = (provider: string, errorCode?: string): void => {
		store.update({
			providerUsage: {
				provider,
				state: "unavailable",
				windows: [],
				...(errorCode ? { errorCode } : {}),
			},
		});
	};

	const refresh = (): Promise<void> => {
		if (inFlight) return inFlight;
		const current = context;
		if (!current) return Promise.resolve();
		const adapter = selectAdapter(current);
		if (!adapter) {
			store.update({ providerUsage: undefined });
			return Promise.resolve();
		}

		const currentGeneration = generation;
		const currentRequestId = ++requestId;
		const controller = new AbortController();
		abortRequest();
		abortController = controller;
		const previous = store.getSnapshot().providerUsage;
		store.update({
			providerUsage: {
				provider: adapter.id,
				state: "loading",
				windows: previous?.provider === adapter.id ? previous.windows : [],
				...(previous?.provider === adapter.id && previous.fetchedAt
					? { fetchedAt: previous.fetchedAt }
					: {}),
			},
		});

		let cacheEntry: UsageCacheEntry | undefined;
		const task = (async () => {
			try {
				const auth = await current.resolveAuth(adapter.id, controller.signal);
				if (!isCurrent(currentGeneration, currentRequestId) || controller.signal.aborted) return;
				if (!auth) {
					publishIfCurrent(currentGeneration, currentRequestId, () =>
						publishUnavailable(adapter.id, "auth"),
					);
					return;
				}
				const key = usageCacheKey(adapter.id, auth.fingerprint, current.model);
				cacheEntry = cache.get(key);
				if (cacheEntry && cacheEntry.expiresAt > now()) {
					const freshEntry = cacheEntry;
					publishIfCurrent(currentGeneration, currentRequestId, () =>
						store.update({ providerUsage: { ...freshEntry.snapshot, state: "fresh" } }),
					);
					return;
				}

				const snapshot = await adapter.query({
					auth,
					signal: controller.signal,
					timeoutMs,
					now,
					...(options.exec ? { exec: options.exec } : {}),
				});
				if (!isCurrent(currentGeneration, currentRequestId) || controller.signal.aborted) return;
				cache.set({
					key,
					snapshot,
					fetchedAt: snapshot.fetchedAt ?? now(),
					expiresAt: now() + cacheTtlMs,
				});
				store.update({ providerUsage: snapshot });
			} catch (error) {
				if (!isCurrent(currentGeneration, currentRequestId) || controller.signal.aborted) return;
				const code = usageErrorCode(error);
				const currentSnapshot = store.getSnapshot().providerUsage;
				const cachedSnapshot = cacheEntry?.snapshot;
				const staleSnapshot =
					currentSnapshot?.provider === adapter.id && currentSnapshot.windows.length > 0
						? currentSnapshot
						: cachedSnapshot?.provider === adapter.id && cachedSnapshot.windows.length > 0
							? cachedSnapshot
							: undefined;
				if (staleSnapshot) {
					store.update({
						providerUsage: {
							...staleSnapshot,
							state: "stale",
							errorCode: code,
						},
					});
				} else {
					publishUnavailable(adapter.id, code);
				}
			}
		})().finally(() => {
			if (inFlight === task) inFlight = undefined;
			if (abortController === controller) abortController = undefined;
		});
		inFlight = task;
		return task;
	};

	const publishIfCurrent = (
		currentGeneration: number,
		currentRequestId: number,
		publish: () => void,
	): void => {
		if (isCurrent(currentGeneration, currentRequestId)) publish();
	};

	return {
		sessionStart(nextContext) {
			generation += 1;
			context = nextContext;
			clearDebounce();
			clearIntervalTimer();
			abortRequest();
			store.update({ providerUsage: undefined });
			if (!options.providers.length || !options.refreshSeconds || !selectAdapter(nextContext))
				return;
			startTimer();
			void refresh();
		},
		modelChanged(nextContext) {
			context = nextContext;
			generation += 1;
			clearDebounce();
			abortRequest();
			store.update({ providerUsage: undefined });
			if (selectAdapter(nextContext)) {
				startTimer();
				void refresh();
			} else {
				clearIntervalTimer();
			}
		},
		turnEnded(nextContext) {
			context = nextContext;
			clearDebounce();
			debounce = setTimeout(() => {
				debounce = undefined;
				void refresh();
			}, debounceMs);
		},
		refresh,
		sessionShutdown() {
			generation += 1;
			context = undefined;
			clearDebounce();
			clearIntervalTimer();
			abortRequest();
			store.update({ providerUsage: undefined });
		},
	};
}
