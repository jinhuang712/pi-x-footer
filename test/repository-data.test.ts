import { describe, expect, it, vi } from "vitest";
import {
	createRepositoryDataSource,
	type GitExecResult,
	type GitExecutor,
	parseGitDiffNumstat,
	parseGitStatusPorcelain,
	readRepositorySnapshot,
} from "../src/data/repository.js";
import { createFooterStore } from "../src/state/store.js";

const successful = (stdout: string): GitExecResult => ({
	stdout,
	stderr: "",
	code: 0,
	killed: false,
});

describe("parseGitDiffNumstat", () => {
	it("parses additions and deletions from numstat output", () => {
		expect(parseGitDiffNumstat("6\t5\tfile.ts\n2\t0\tnew.ts\n")).toEqual({
			additions: 8,
			deletions: 5,
		});
		expect(parseGitDiffNumstat("-\t-\tbinary.dat\n")).toBeUndefined();
	});
});

describe("parseGitStatusPorcelain", () => {
	it("parses branch tracking and working tree status", () => {
		const summary = parseGitStatusPorcelain(
			[
				"## main...origin/main [ahead 2, behind 1]",
				"M  staged.ts",
				" M modified.ts",
				"?? untracked.ts",
				"UU conflict.ts",
			].join("\n"),
		);

		expect(summary).toEqual({
			branch: "main",
			ahead: 2,
			behind: 1,
			staged: 1,
			modified: 1,
			untracked: 1,
			conflicts: 1,
			addedFiles: 0,
			deletedFiles: 0,
			modifiedFiles: 2,
		});
	});

	it("classifies tracked files into new, deleted, and modified", () => {
		const summary = parseGitStatusPorcelain(
			["A  new.ts", " D gone.ts", "M  staged.ts", "AM both.ts", "?? untracked.ts"].join("\n"),
		);
		expect(summary.addedFiles).toBe(2);
		expect(summary.deletedFiles).toBe(1);
		expect(summary.modifiedFiles).toBe(1);
		expect(summary.untracked).toBe(1);
	});

	it("handles detached and unborn branches", () => {
		expect(parseGitStatusPorcelain("## HEAD (no branch)\n").branch).toBe("detached");
		expect(parseGitStatusPorcelain("## No commits yet on feature\n").branch).toBe("feature");
	});
});

describe("readRepositorySnapshot", () => {
	it("normalizes a successful repository response", async () => {
		const executor: GitExecutor = {
			exec: vi
				.fn()
				.mockResolvedValueOnce(successful("## main\n M file.ts\n"))
				.mockResolvedValueOnce(successful("6\t5\tfile.ts\n")),
		};
		const snapshot = await readRepositorySnapshot(
			executor,
			"/workspace/project",
			new AbortController().signal,
		);

		expect(snapshot).toEqual({
			isRepository: true,
			branch: "main",
			dirty: true,
			staged: false,
			ahead: 0,
			behind: 0,
			changedFiles: 1,
			additions: 6,
			deletions: 5,
			addedFiles: 0,
			deletedFiles: 0,
			modifiedFiles: 1,
			untrackedFiles: 0,
			conflicts: 0,
			state: "fresh",
		});
		expect(executor.exec).toHaveBeenCalledWith(
			"git",
			["--no-optional-locks", "status", "--porcelain=v1", "--branch", "--untracked-files=normal"],
			expect.objectContaining({ cwd: "/workspace/project", timeout: 3000 }),
		);
	});

	it("returns a fresh no-repository result when Git confirms the directory is not a repository", async () => {
		const executor: GitExecutor = {
			exec: vi.fn(async () => ({
				...successful(""),
				code: 128,
				stderr: "fatal: not a git repository",
			})),
		};
		expect(await readRepositorySnapshot(executor, "/tmp", new AbortController().signal)).toEqual({
			isRepository: false,
			state: "fresh",
		});
	});

	it("keeps unrelated Git failures unavailable", async () => {
		const executor: GitExecutor = {
			exec: vi.fn(async () => ({ ...successful(""), code: 128, stderr: "fatal: bad config" })),
		};
		expect(await readRepositorySnapshot(executor, "/tmp", new AbortController().signal)).toEqual({
			isRepository: false,
			state: "unavailable",
		});
	});
});

describe("RepositoryDataSource", () => {
	it("refreshes asynchronously and ignores a replaced session result", async () => {
		const store = createFooterStore();
		let resolveFirst: ((result: GitExecResult) => void) | undefined;
		const firstResult = new Promise<GitExecResult>((resolve) => {
			resolveFirst = resolve;
		});
		const executor: GitExecutor = {
			exec: vi
				.fn()
				.mockReturnValueOnce(firstResult)
				.mockResolvedValueOnce(successful("## second\n")),
		};
		const source = createRepositoryDataSource(store, executor, { refreshIntervalMs: 0 });

		source.sessionStart("/workspace/first");
		source.sessionStart("/workspace/second");
		await source.refresh();
		resolveFirst?.(successful("## first\n M stale.ts\n"));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(store.getSnapshot().repository).toMatchObject({
			isRepository: true,
			branch: "second",
			state: "fresh",
		});
		source.sessionShutdown();
	});

	it("marks a failed refresh stale when previous repository data exists", async () => {
		const store = createFooterStore();
		const executor: GitExecutor = {
			exec: vi
				.fn()
				.mockResolvedValueOnce(successful("## main\n"))
				.mockRejectedValueOnce(new Error("git unavailable")),
		};
		const source = createRepositoryDataSource(store, executor, { refreshIntervalMs: 0 });
		source.sessionStart("/workspace/project");
		await source.refresh();
		await source.refresh();
		expect(store.getSnapshot().repository.state).toBe("stale");
		source.sessionShutdown();
	});
});
