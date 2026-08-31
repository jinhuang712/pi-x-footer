import type { FooterStore } from "../state/store.js";
import type { RepositorySnapshot } from "../state/types.js";

const DEFAULT_REFRESH_INTERVAL_MS = 30_000;
const GIT_TIMEOUT_MS = 3_000;
const GIT_STATUS_ARGS = [
	"--no-optional-locks",
	"status",
	"--porcelain=v1",
	"--branch",
	"--untracked-files=normal",
];
const GIT_DIFF_ARGS = ["--no-optional-locks", "diff", "--numstat", "HEAD"];

export interface GitExecOptions {
	cwd: string;
	timeout: number;
	signal: AbortSignal;
}

export interface GitExecResult {
	stdout: string;
	stderr: string;
	code: number;
	killed: boolean;
}

export interface GitExecutor {
	exec(command: string, args: string[], options: GitExecOptions): Promise<GitExecResult>;
}

export interface GitStatusSummary {
	branch?: string;
	ahead: number;
	behind: number;
	staged: number;
	modified: number;
	untracked: number;
	conflicts: number;
	/** Per-file classification used by the Git `full` display. */
	addedFiles: number;
	deletedFiles: number;
	modifiedFiles: number;
}

export interface GitDiffSummary {
	additions: number;
	deletions: number;
}

export interface RepositoryDataSource {
	sessionStart(cwd: string): void;
	refresh(): Promise<void>;
	sessionShutdown(): void;
}

export interface RepositoryDataSourceOptions {
	refreshIntervalMs?: number;
	timeoutMs?: number;
}

export function createRepositoryDataSource(
	store: FooterStore,
	executor: GitExecutor,
	options: RepositoryDataSourceOptions = {},
): RepositoryDataSource {
	const refreshIntervalMs = options.refreshIntervalMs ?? DEFAULT_REFRESH_INTERVAL_MS;
	const timeoutMs = options.timeoutMs ?? GIT_TIMEOUT_MS;
	let activeCwd: string | undefined;
	let generation = 0;
	let requestId = 0;
	let refreshTimer: ReturnType<typeof setInterval> | undefined;
	let abortController: AbortController | undefined;
	let inFlight: Promise<void> | undefined;

	const clearTimer = () => {
		if (!refreshTimer) return;
		clearInterval(refreshTimer);
		refreshTimer = undefined;
	};

	const abortRefresh = () => {
		abortController?.abort(new DOMException("Repository refresh replaced", "AbortError"));
		abortController = undefined;
	};

	const isCurrentRequest = (cwd: string, currentGeneration: number, currentRequestId: number) =>
		activeCwd === cwd && generation === currentGeneration && requestId === currentRequestId;

	const refresh = (): Promise<void> => {
		if (inFlight) return inFlight;
		if (!activeCwd) return Promise.resolve();

		const cwd = activeCwd;
		const currentGeneration = generation;
		const currentRequestId = ++requestId;
		const controller = new AbortController();
		const previousRepository = store.getSnapshot().repository;
		abortRefresh();
		abortController = controller;
		store.update({ repository: { state: "loading" } });

		const work = readRepositorySnapshot(executor, cwd, controller.signal, timeoutMs)
			.then((repository) => {
				if (isCurrentRequest(cwd, currentGeneration, currentRequestId)) {
					store.update({ repository });
				}
			})
			.catch(() => {
				if (!isCurrentRequest(cwd, currentGeneration, currentRequestId)) return;
				store.update({
					repository: {
						state: previousRepository.isRepository ? "stale" : "unavailable",
					},
				});
			})
			.finally(() => {
				if (inFlight === work) inFlight = undefined;
				if (abortController === controller) abortController = undefined;
			});
		inFlight = work;
		return work;
	};

	return {
		sessionStart(cwd) {
			generation += 1;
			activeCwd = cwd;
			requestId += 1;
			abortRefresh();
			inFlight = undefined;
			clearTimer();
			store.update({
				repository: {
					isRepository: false,
					branch: undefined,
					dirty: undefined,
					staged: undefined,
					ahead: undefined,
					behind: undefined,
					changedFiles: undefined,
					additions: undefined,
					deletions: undefined,
					addedFiles: undefined,
					deletedFiles: undefined,
					modifiedFiles: undefined,
					untrackedFiles: undefined,
					conflicts: undefined,
					state: "loading",
				},
			});
			void refresh();
			if (refreshIntervalMs > 0)
				refreshTimer = setInterval(() => void refresh(), refreshIntervalMs);
		},
		refresh,
		sessionShutdown() {
			generation += 1;
			activeCwd = undefined;
			requestId += 1;
			abortRefresh();
			clearTimer();
			store.update({
				repository: {
					isRepository: false,
					branch: undefined,
					dirty: undefined,
					staged: undefined,
					ahead: undefined,
					behind: undefined,
					changedFiles: undefined,
					additions: undefined,
					deletions: undefined,
					addedFiles: undefined,
					deletedFiles: undefined,
					modifiedFiles: undefined,
					untrackedFiles: undefined,
					conflicts: undefined,
					state: "unavailable",
				},
			});
		},
	};
}

export async function readRepositorySnapshot(
	executor: GitExecutor,
	cwd: string,
	signal: AbortSignal,
	timeoutMs = GIT_TIMEOUT_MS,
): Promise<RepositorySnapshot> {
	const result = await executor.exec("git", GIT_STATUS_ARGS, {
		cwd,
		timeout: timeoutMs,
		signal,
	});
	if (result.code !== 0 || result.killed) {
		return {
			isRepository: false,
			state: !result.killed && isNotRepositoryError(result.stderr) ? "fresh" : "unavailable",
		};
	}

	const summary = parseGitStatusPorcelain(result.stdout);
	const changedFiles = summary.staged + summary.modified + summary.untracked;
	const diff = await readGitDiffSummary(executor, cwd, signal, timeoutMs);
	return {
		isRepository: true,
		...(summary.branch ? { branch: summary.branch } : {}),
		dirty: changedFiles > 0 || summary.conflicts > 0,
		staged: summary.staged > 0,
		ahead: summary.ahead,
		behind: summary.behind,
		changedFiles: changedFiles + summary.conflicts,
		...(diff ? { additions: diff.additions, deletions: diff.deletions } : {}),
		addedFiles: summary.addedFiles,
		deletedFiles: summary.deletedFiles,
		modifiedFiles: summary.modifiedFiles,
		untrackedFiles: summary.untracked,
		conflicts: summary.conflicts,
		state: "fresh",
	};
}

async function readGitDiffSummary(
	executor: GitExecutor,
	cwd: string,
	signal: AbortSignal,
	timeoutMs: number,
): Promise<GitDiffSummary | undefined> {
	try {
		const result = await executor.exec("git", GIT_DIFF_ARGS, {
			cwd,
			timeout: timeoutMs,
			signal,
		});
		if (result.code !== 0 || result.killed) return undefined;
		return parseGitDiffNumstat(result.stdout);
	} catch {
		// Diff statistics are optional; status data remains useful if this query fails.
		return undefined;
	}
}

export function parseGitDiffNumstat(output: string): GitDiffSummary | undefined {
	let additions = 0;
	let deletions = 0;
	let hasStats = false;
	for (const line of output.split(/\r?\n/u)) {
		const match = line.match(/^(\d+|-)\s+(\d+|-)\s+/u);
		if (!match || (match[1] === "-" && match[2] === "-")) continue;
		hasStats = true;
		if (match[1] !== "-") additions += Number(match[1]);
		if (match[2] !== "-") deletions += Number(match[2]);
	}
	return hasStats ? { additions, deletions } : undefined;
}

export function parseGitStatusPorcelain(output: string): GitStatusSummary {
	const summary: GitStatusSummary = {
		ahead: 0,
		behind: 0,
		staged: 0,
		modified: 0,
		untracked: 0,
		conflicts: 0,
		addedFiles: 0,
		deletedFiles: 0,
		modifiedFiles: 0,
	};

	for (const line of output.split(/\r?\n/u)) {
		if (!line) continue;
		if (line.startsWith("## ")) {
			parseBranchLine(line.slice(3), summary);
			continue;
		}
		const indexStatus = line[0] ?? " ";
		const worktreeStatus = line[1] ?? " ";
		if (indexStatus === "?" && worktreeStatus === "?") {
			summary.untracked += 1;
			continue;
		}
		if (isConflictStatus(indexStatus, worktreeStatus)) {
			summary.conflicts += 1;
			continue;
		}
		if (isChangedStatus(indexStatus)) summary.staged += 1;
		if (isChangedStatus(worktreeStatus)) summary.modified += 1;
		// Classify each tracked file once: new beats deleted beats modified.
		if (indexStatus === "A" || worktreeStatus === "A") summary.addedFiles += 1;
		else if (indexStatus === "D" || worktreeStatus === "D") summary.deletedFiles += 1;
		else summary.modifiedFiles += 1;
	}
	return summary;
}

function parseBranchLine(value: string, summary: GitStatusSummary): void {
	const ahead = value.match(/\bahead (\d+)/u);
	const behind = value.match(/\bbehind (\d+)/u);
	summary.ahead = ahead ? Number(ahead[1]) : 0;
	summary.behind = behind ? Number(behind[1]) : 0;

	if (value.includes("(no branch)")) {
		summary.branch = "detached";
		return;
	}
	const noCommitBranch = value.match(/^No commits yet on (.+?)(?:\s|$)/u);
	if (noCommitBranch?.[1]) {
		summary.branch = noCommitBranch[1];
		return;
	}
	const branch = value.split("...")[0]?.split(" [")[0]?.trim();
	if (branch) summary.branch = branch;
}

function isConflictStatus(indexStatus: string, worktreeStatus: string): boolean {
	return (
		(indexStatus === "D" && worktreeStatus === "D") ||
		(indexStatus === "A" && worktreeStatus === "A") ||
		indexStatus === "U" ||
		worktreeStatus === "U"
	);
}

function isChangedStatus(status: string): boolean {
	return status !== " " && status !== "?" && status !== "!";
}

function isNotRepositoryError(stderr: string): boolean {
	return /not (?:a )?git repository|not a repository/iu.test(stderr);
}
