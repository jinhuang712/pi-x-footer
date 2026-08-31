# Technical Architecture

## 1. Architecture principles

1. **Footer-only**: only the public Footer registration is required to replace the built-in display.
2. **Pure rendering**: rendering consumes immutable state and never performs I/O.
3. **Asynchronous collection**: Git, provider usage, and other slow sources update state outside rendering.
4. **Provider-neutral core**: the renderer consumes normalized usage data, not provider-specific payloads.
5. **Failure isolation**: optional data may become unavailable without taking down the extension.
6. **Stable layout contract**: configuration describes rows and Segments, not terminal escape sequences.
7. **Public API only**: no private Pi component or internal Footer implementation dependency.

## 2. Runtime flow

```text
Pi extension load
      │
      ▼
Configuration Loader ────────► Config Store
      │
      ▼
Extension Controller
      │
      ├── Session Data Sources
      ├── Git/Data Sources
      ├── Provider Usage Manager
      └── Pi lifecycle subscriptions
      │
      ▼
Footer State Store
      │
      ▼
ctx.ui.setFooter(...)
      │
      ▼
Snapshot → Segment Resolver → Layout Engine → Renderer → lines
```

## 3. Module responsibilities

### `extension.ts`

MUST:

- Load and validate configuration.
- Create the state store and data managers.
- Register the Footer through `ctx.ui.setFooter(...)`.
- Register `/xfooter` commands.
- Subscribe to lifecycle changes.
- Dispose all timers, subscriptions, and pending requests.

MUST NOT contain detailed rendering or provider parsing logic.

### `state/`

Owns the latest immutable `FooterSnapshot`.

The store SHOULD support:

- Partial source updates.
- Monotonic update versions.
- Change coalescing/debouncing.
- Explicit invalidation for Footer redraw.
- Source-specific error states.

A failed source update MUST preserve the last valid value where safe and mark it stale.

### `data/`

Collects Pi-local data:

- Session/provider/model state.
- Context and token usage.
- Cache statistics.
- Cost.
- Current directory and Git status.
- Active tool status.
- Other extension statuses exposed by the public API.

These modules do not know row layout or colors.

### `usage/`

Collects provider account usage. It owns:

- Provider matching.
- Runtime credential resolution.
- Endpoint validation.
- Request timeouts and cancellation.
- Response normalization.
- Cache and stale state.
- Refresh scheduling.

It returns `ProviderUsageSnapshot` values only.

### `segments/`

Maps normalized Snapshot data to named Segment values. A Segment may return no value when its source is empty, unsupported, or configured off.

### `layout/`

Places resolved Segments into configured rows, applies alignment, measures visible width, and drops/compacts optional values when needed.

### `render/`

Converts Segment values and semantic states into Pi TUI-compatible styled text. It owns:

- Theme role lookup.
- Separator style.
- Optional icons.
- ANSI-aware width measurement.
- Safe truncation.

## 4. Render contract

The renderer SHOULD expose a pure boundary similar to:

```ts
renderFooter(
  snapshot: FooterSnapshot,
  config: FooterConfig,
  width: number,
  theme: PiTheme,
): FooterLine[];
```

The exact Pi Component type is determined during implementation from the installed public TUI API. The business renderer MUST remain testable without creating a live Pi TUI.

## 5. Dependency boundaries

```text
config ──────────────┐
data ────────────────┤
usage ───────────────┤
                     ▼
                 snapshot
                     │
                 segments
                     │
                 layout
                     │
                 render
                     │
              Pi Footer Component
```

Forbidden dependencies:

- `render` → network/filesystem/Git.
- `layout` → Pi lifecycle/context.
- provider adapters → Footer layout.
- commands → direct mutation of renderer internals.

## 6. Package boundary

The package SHOULD follow Pi extension packaging conventions:

- Authoritative source under `src/`.
- Generated runtime entry under `dist/index.ts`.
- `package.json` declares the Pi extension entry.
- Build output is deterministic.
- Tests run against source modules and the generated boundary where practical.

## 7. Footer conflict policy

`pi-x-footer` replaces the final Footer renderer. Another Footer-replacing extension may overwrite it depending on load order.

The README MUST warn users not to enable `pi-statusline`, `pi-powerline-footer`, or another Footer replacement at the same time. `pi-usage` is not a Footer replacement and may coexist, although duplicate provider polling should be documented if both implement the same usage source.
