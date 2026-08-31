export type UsageErrorCode =
	| "aborted"
	| "auth"
	| "invalid-response"
	| "network"
	| "timeout"
	| "unauthorized"
	| "unsupported";

export class UsageError extends Error {
	readonly code: UsageErrorCode;

	constructor(code: UsageErrorCode, message: string) {
		super(message);
		this.name = "UsageError";
		this.code = code;
	}
}

export function usageErrorCode(error: unknown): UsageErrorCode {
	if (error instanceof UsageError) return error.code;
	if (error instanceof Error && error.name === "AbortError") return "aborted";
	return "network";
}
