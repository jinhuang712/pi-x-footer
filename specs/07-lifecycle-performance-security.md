# Lifecycle, Performance, Security, and Compatibility

## 1. Lifecycle behavior

The extension MUST own all resources it creates.

### Startup

- Load configuration.
- Initialize an empty but valid Snapshot.
- Register Footer and commands.
- Subscribe to relevant public Pi lifecycle events.
- Start data collection only after the active session/model is known.

### Runtime

- Apply local data updates immediately when available.
- Coalesce multiple updates into one redraw.
- Refresh provider usage on a bounded schedule.
- Keep the last good provider snapshot as stale data when appropriate.

### Shutdown

- Abort provider requests.
- Clear timers and debounce handles.
- Remove listeners/subscriptions where the API requires it.
- Avoid writes during shutdown unless explicitly requested.

## 2. Event-to-data mapping

The exact event names must be confirmed against the target Pi version, but the implementation should cover these transitions:

| Transition | Data to update |
|---|---|
| Session start | session, cwd, model, initial usage |
| Model/provider change | provider, model, thinking, provider usage adapter |
| Turn start | streaming/tool state |
| Tool call/result | active tool state |
| Assistant response complete | tokens, cache, cost, context |
| Directory/repository change | cwd, Git |
| Extension status change | extension statuses |
| Timer tick | provider usage freshness |
| Session shutdown | cleanup only |

## 3. Performance budgets

Target budgets for the synchronous render path:

- No network or process execution.
- No filesystem reads.
- No unbounded loops over session history.
- Normal render planning SHOULD complete in under 5 ms for a typical configuration.
- A single state burst SHOULD cause at most one redraw per debounce window.
- Provider usage requests MUST be bounded by timeout and concurrency limits.

Git and provider usage data SHOULD be cached and refreshed independently from rendering.

## 4. Concurrency

The Usage Manager MUST ensure:

- At most one active query per provider/account key by default.
- A newer query can invalidate an older result.
- Late responses cannot overwrite a newer active-model snapshot.
- Shutdown aborts pending requests.
- Provider failures are captured as data state, not uncaught exceptions.

## 5. Security and privacy

The extension runs with the user's process privileges. It MUST:

- Never log access tokens, API keys, cookies, or raw authorization headers.
- Never persist provider credentials.
- Avoid persisting opaque account IDs unless explicitly needed for a non-secret cache key; a one-way fingerprint is preferred.
- Redact secrets from user-facing errors.
- Validate the effective provider origin before sending runtime credentials to a usage endpoint.
- Avoid Codex CLI account fallback when it could differ from Pi's active account.
- Treat provider responses as untrusted display data and sanitize control characters.
- Limit provider usage to supported official endpoints in v0.1.

## 6. Extension conflict behavior

The extension SHOULD detect or document the possibility that another Footer replacement loads after it. It MUST NOT use private APIs to force ownership.

The README MUST clearly state:

```text
Do not enable pi-statusline or pi-powerline-footer at the same time as pi-x-footer.
```

`pi-usage` can coexist because it does not replace the Footer, but users may see duplicate provider polling if both packages perform their own refresh.

## 7. Terminal compatibility

The renderer MUST support:

- Color terminal.
- Monochrome terminal.
- No Nerd Font.
- Narrow width.
- Wide width.
- Unicode-capable terminal.
- ASCII fallback.

Powerline and Emoji are optional style inputs and MUST never be required for correct layout.

## 8. Pi compatibility

The package SHOULD target the currently inspected Pi public API and declare an appropriate peer dependency range. Any API used by the extension MUST be verified against public Pi documentation before implementation.

The implementation MUST not import Pi's internal compiled Footer implementation as a runtime dependency.
