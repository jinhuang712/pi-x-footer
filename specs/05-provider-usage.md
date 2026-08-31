# Provider Usage Monitoring Specification

## 1. Scope

v0.1 includes four account-level usage adapters:

- OpenAI Codex (`openai-codex`).
- OpenCode Go (`opencode-go`).
- Volcano Engine Agent Plan (`volcengine-agent-plan`).
- Volcano Engine Coding Plan (`volcengine-coding-plan`).

This is separate from current-session token, context, cache, and cost metrics.

The implementation may reuse or materially adapt relevant MIT-licensed logic from `@narumitw/pi-usage`. Unrelated features such as Fast mode, reset redemption, Copilot, OpenRouter, and the `/usage` menu are out of scope. Any copied or materially adapted source MUST be recorded in `NOTICE.md`.

## 2. Adapter interface

```ts
interface UsageProviderAdapter {
  id: string;
  displayName: string;
  matches(input: UsageMatchInput): boolean;
  query(input: UsageQueryInput): Promise<ProviderUsageSnapshot>;
}
```

The adapter MUST return normalized data and MUST NOT return provider-specific raw JSON to the renderer.

## 3. Normalized snapshot

```ts
interface ProviderUsageSnapshot {
  provider: string;
  state: "fresh" | "loading" | "stale" | "error" | "unavailable";
  fetchedAt?: number;
  errorCode?: string;
  windows: UsageWindow[];
}

interface UsageWindow {
  id: string;
  label: string;
  usedPercent?: number;
  resetAt?: number;
  state: "normal" | "warning" | "error" | "expired" | "unknown";
}
```

The adapter MUST normalize values so the renderer always receives usage percentage in the same direction: percentage already used.

## 4. OpenAI Codex

The adapter SHOULD expose the current model-relevant usage bucket when available, plus other useful windows such as short-term and weekly windows.

Example normalized output:

```json
{
  "provider": "openai-codex",
  "state": "fresh",
  "windows": [
    { "id": "5h", "label": "5h", "usedPercent": 59, "state": "normal" },
    { "id": "week", "label": "wk", "usedPercent": 61, "state": "normal" }
  ]
}
```

The adapter MUST:

- Use the account/authentication Pi is actually using for the selected model.
- Validate that the effective provider origin is an allowed official origin before sending credentials.
- Avoid Codex CLI fallback when it can refer to a different account.
- Abort on session replacement or shutdown.
- Avoid persisting account IDs, bearer tokens, or opaque provider identifiers.

Reset redemption and other mutations are explicitly excluded.

## 5. OpenCode Go

The adapter SHOULD expose the provider's rolling, weekly, and monthly windows when present.

Example normalized output:

```json
{
  "provider": "opencode-go",
  "state": "fresh",
  "windows": [
    { "id": "rolling", "label": "5h", "usedPercent": 0, "state": "normal" },
    { "id": "weekly", "label": "w", "usedPercent": 4, "state": "normal" },
    { "id": "monthly", "label": "m", "usedPercent": 2, "state": "normal" }
  ]
}
```

The adapter MUST only send credentials to the validated official OpenCode origin and MUST reject unsupported custom/proxy origins unless a future explicit policy permits them.

## 6. Volcano Engine Plans

Both Ark subscription plans share the same control-plane quota source and `arkcli` CLI transport; they differ only in the endpoint origin, the `--product` argument, and the short-window label.

### 6.1 Agent Plan

The `volcengine-agent-plan` adapter reports the subscription quota shown on the Ark console `subscription/agent-plan` page: the same 5h / weekly / monthly windows with used, total, percent, and reset time.

```bash
arkcli usage plan --product agent-plan --format json
```

Example normalized output:

```json
{
  "provider": "volcengine-agent-plan",
  "state": "fresh",
  "windows": [
    { "id": "5h", "label": "5h", "usedPercent": 5, "state": "normal" },
    { "id": "weekly", "label": "w", "usedPercent": 66, "state": "warning" },
    { "id": "monthly", "label": "m", "usedPercent": 81, "state": "warning" }
  ]
}
```

### 6.2 Coding Plan

The `volcengine-coding-plan` adapter reports the Coding Plan quota through the same CLI path with `--product coding-plan`. Coding Plan names its short rolling window `session` and the backend only returns a percent (no absolute used/total), so the adapter maps `session` to the shared 5h window and exposes weekly / monthly percents:

```bash
arkcli usage plan --product coding-plan --format json
```

Example normalized output:

```json
{
  "provider": "volcengine-coding-plan",
  "state": "fresh",
  "windows": [
    { "id": "session", "label": "5h", "usedPercent": 12, "state": "normal" },
    { "id": "weekly", "label": "w", "usedPercent": 45, "state": "normal" },
    { "id": "monthly", "label": "m", "usedPercent": 73, "state": "warning" }
  ]
}
```

The adapters MUST:

- Only match the official provider id on its official `https://ark.cn-beijing.volces.com` origin: Agent Plan under `/api/plan/*`, Coding Plan under `/api/coding/*`; the pay-as-you-go `/api/v3` runtime is never queried.
- Resolve auth through the `arkcli` CLI login instead of an HTTP credential; no model API key is sent anywhere.
- Not persist the `viewer` account identifiers returned by arkcli.
- Map a missing/inactive subscription and a login failure to safe `unsupported` / `auth` states instead of surfacing raw CLI output.
- Abort the underlying command on session replacement or shutdown.

## 7. Usage manager

The Usage Manager owns adapter selection, caching, and refresh.

```text
selected model/provider changes
              │
              ▼
       match adapter
              │
              ▼
       resolve current auth
              │
              ▼
        query with timeout
              │
              ▼
      normalize and cache
              │
              ▼
        update Snapshot
```

Default refresh policy:

- Initial query after the active model is known.
- Debounced refresh after a completed turn.
- Periodic refresh every 30 seconds while the session is active.
- Manual `/xfooter refresh`.
- Cancel immediately on session shutdown or replacement.

The timer interval MUST be configurable, with a safe minimum to prevent accidental request loops.

## 8. Cache policy

Cache keys MUST include at least:

```text
provider ID
active account/auth fingerprint
model-relevant identity where applicable
```

Cache values MUST include:

```text
snapshot
fetchedAt
expiresAt
lastError if any
```

When a refresh fails but a previous snapshot exists, keep the previous data as `stale` and expose a warning state. If no snapshot exists, hide the usage Segment or show a muted unavailable state according to configuration.

## 9. Error behavior

Provider usage errors are non-fatal:

- Do not throw through the Footer render path.
- Do not stop local data refresh.
- Do not block a model request.
- Do not show raw network errors containing credentials or URLs with secrets.
- Allow a later refresh to recover.

Suggested error states:

```text
loading       dim (keep the Usage row visible with muted `—` values)
stale         warning
unauthorized  muted or warning
unsupported   hidden
network       stale if cached, otherwise hidden
```

## 10. Footer display

Usage display is controlled by three independent settings:

- **Windows:** select `5h`, `week`, and/or `month`. Provider aliases such as `rolling`, `weekly`, and `monthly` are normalized to these user-facing names. Only selected windows returned by the active Provider are rendered.
- **Resets:** show or hide reset countdowns independently of detail level.
- **Detail:** choose one of three display levels. Preset selectors MUST NOT contain more than four choices.

```text
compact   Usage: 59% · 61%
standard  Usage: Codex 59% (5hr) · 61% (7d)
detailed  Usage: Codex 59% (5hr resets in 2hr13m) · 61% (7d)
```

With Resets enabled, Compact appends concise reset countdowns and Standard uses a short `reset` suffix; Detailed uses the full relative `resets in` wording. If a Provider does not return `resetAt`, that window omits reset text. If no selected window is returned, the Usage Segment is hidden rather than producing an empty line.

The default Custom profile selects `5h` and `week`, enables reset display, and refreshes every 30 seconds. `month` is available but off by default to keep the Footer calm. Built-in Footer presets change Detail (`compact`, `standard`, or `detailed`) but preserve the user's window, reset, alert, and refresh preferences.

`Codex` / `OpenCode Go` / `Ark` / `Coding` uses the provider accent color, while each percentage uses its independent quota state color. The Segment MUST not show secrets, account tokens, or opaque account IDs.

## 11. Coexistence with `pi-usage`
`pi-usage` may be installed for its interactive `/usage` flow. `pi-x-footer` should not import the whole extension as a runtime dependency.

If both extensions query the same provider, duplicate polling is acceptable for the first implementation but SHOULD be documented. A future version MAY define a structured, versioned usage handoff protocol.
