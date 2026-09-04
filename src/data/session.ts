import { homedir } from "node:os";
import type { FooterStore } from "../state/store.js";
import type { RuntimeSnapshot, SessionSnapshot } from "../state/types.js";

export interface SessionContext {
	cwd: string;
	mode: string;
	model?: {
		provider: string;
		id: string;
	};
	thinkingLevel?: string;
	/** Test/embedding override for the home directory. */
	home?: string;
}

export interface SessionDataSource {
	sessionStart(context: SessionContext): void;
	modelChanged(context: SessionContext): void;
	thinkingLevelChanged(context: SessionContext): void;
	agentStarted(context: SessionContext): void;
	agentEnded(context: SessionContext): void;
	sessionShutdown(context: SessionContext): void;
}

export function createSessionDataSource(store: FooterStore): SessionDataSource {
	let sessionGeneration = 0;
	let isStreaming = false;
	// The home directory never changes within a process; read it once here so
	// Segment resolution stays pure and deterministic per Snapshot.
	const home = safeHomedir();

	const sync = (context: SessionContext): void => {
		store.update({
			session: sessionSnapshotFromContext({ home, ...context }, isStreaming),
			runtime: {
				mode: runtimeModeFromContext(context.mode),
				sessionGeneration,
			},
		});
	};

	return {
		sessionStart(context) {
			sessionGeneration += 1;
			isStreaming = false;
			sync(context);
		},
		modelChanged(context) {
			sync(context);
		},
		thinkingLevelChanged(context) {
			sync(context);
		},
		agentStarted(context) {
			isStreaming = true;
			sync(context);
		},
		agentEnded(context) {
			isStreaming = false;
			sync(context);
		},
		sessionShutdown(context) {
			isStreaming = false;
			store.update({
				session: { ...sessionSnapshotFromContext(context, false), isStreaming: false },
				runtime: { mode: "unknown", sessionGeneration },
			});
		},
	};
}

export function sessionSnapshotFromContext(
	context: SessionContext,
	isStreaming = false,
): SessionSnapshot {
	return {
		...(context.model?.provider ? { provider: context.model.provider } : {}),
		...(context.model?.id ? { model: context.model.id } : {}),
		...(context.thinkingLevel ? { thinkingLevel: context.thinkingLevel } : {}),
		...(context.home ? { home: context.home } : {}),
		cwd: context.cwd,
		isStreaming,
	};
}

function safeHomedir(): string | undefined {
	try {
		return homedir();
	} catch {
		return undefined;
	}
}

export function runtimeModeFromContext(mode: SessionContext["mode"]): RuntimeSnapshot["mode"] {
	if (mode === "tui" || mode === "rpc" || mode === "print" || mode === "json") return mode;
	return "unknown";
}
