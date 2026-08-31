import type { UsageProviderId } from "../config/types.js";
import type { ProviderUsageSnapshot } from "../state/types.js";

export interface UsageMatchInput {
	provider?: string;
	model?: string;
	baseUrl?: string;
}

export interface UsageAuth {
	apiKey?: string;
	headers: Record<string, string>;
	baseUrl?: string;
	fingerprint: string;
}

export type UsageFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface UsageExecOptions {
	timeout: number;
	signal: AbortSignal;
}

export interface UsageExecResult {
	stdout: string;
	stderr: string;
	code: number;
	killed: boolean;
}

export type UsageExecutor = (
	command: string,
	args: string[],
	options: UsageExecOptions,
) => Promise<UsageExecResult>;

export interface UsageQueryInput {
	auth: UsageAuth;
	signal: AbortSignal;
	timeoutMs: number;
	fetch?: UsageFetch;
	exec?: UsageExecutor;
	now?: () => number;
}

export interface UsageProviderAdapter {
	readonly id: UsageProviderId;
	readonly displayName: string;
	matches(input: UsageMatchInput): boolean;
	query(input: UsageQueryInput): Promise<ProviderUsageSnapshot>;
}

export interface UsageSessionContext extends UsageMatchInput {
	resolveAuth(provider: UsageProviderId, signal: AbortSignal): Promise<UsageAuth | undefined>;
}

export interface UsageManagerOptions {
	store: import("../state/store.js").FooterStore;
	providers: readonly UsageProviderId[];
	refreshSeconds: number;
	timeoutMs?: number;
	cacheTtlMs?: number;
	debounceMs?: number;
	adapters?: readonly UsageProviderAdapter[];
	exec?: UsageExecutor;
	now?: () => number;
}

export interface UsageManager {
	sessionStart(context: UsageSessionContext): void;
	modelChanged(context: UsageSessionContext): void;
	turnEnded(context: UsageSessionContext): void;
	refresh(): Promise<void>;
	sessionShutdown(): void;
}
