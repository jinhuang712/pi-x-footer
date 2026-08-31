# Detailed Implementation Plan

## 1. Delivery strategy

Implement from the inside out:

```text
package foundation
  → config
  → normalized state
  → Segment registry
  → layout/rendering
  → Pi lifecycle integration
  → Provider usage
  → commands/UI
  → hardening/release
```

Each phase should end with a runnable and testable result. Provider usage must not be implemented directly inside the Footer callback.

## 2. Phase 0 — Repository and package foundation

### Tasks

- Create `package.json`, TypeScript config, formatter/linter config, and build script.
- Declare the Pi runtime peer dependency range.
- Add `LICENSE` with the project license.
- Add initial `README.md`.
- Add `NOTICE.md` placeholder for upstream attribution.
- Create `src/index.ts` and a minimal extension entry.
- Confirm the generated `dist/index.ts` loading convention.

### Deliverable

A package that Pi can load and that registers a placeholder Footer without changing other behavior.

### Exit criteria

- Build succeeds.
- Typecheck succeeds.
- Pi can load the local package.
- A smoke test confirms `ctx.ui.setFooter` is called.

## 3. Phase 1 — Configuration subsystem

### Tasks

- Implement config types and defaults.
- Implement schema validation and normalization.
- Implement global path resolution.
- Implement project path resolution behind the opt-in gate.
- Implement precedence and merge behavior.
- Implement atomic persistence.
- Add version field and migration boundary.

### Deliverable

`loadConfig()`, `saveConfig()`, `normalizeConfig()`, and test fixtures.

### Exit criteria

- Missing, malformed, partial, and valid configurations are covered by tests.
- Project config remains ignored by default.
- A failed write preserves the existing file.

## 4. Phase 2 — Snapshot Store and local data

### Tasks

- Define `FooterSnapshot` and local data types.
- Implement immutable state updates.
- Add session/provider/model extraction.
- Add context/token/cache/cost data extraction.
- Add CWD and Git data source with caching.
- Add active tool state.
- Add generic extension status source.
- Add invalidation/debounce mechanism.

### Deliverable

A live Snapshot populated with local data, independent of layout.

### Exit criteria

- State updates are isolated by source.
- A missing source does not invalidate the whole Snapshot.
- Repeated events are coalesced.
- No slow source runs in the render path.

## 5. Phase 3 — Segment registry and formatting

### Tasks

- Define Segment and ResolvedSegment contracts.
- Implement registry and lookup validation.
- Implement built-in Segments:
  - `identity`
  - `provider`
  - `model`
  - `thinking`
  - `cwd`
  - `git`
  - `context`
  - `tokens`
  - `cache`
  - `cost`
  - `tools`
  - `extensions`
- Implement compact formatters for paths, tokens, cost, and context.
- Add empty-value handling and priorities.

### Deliverable

A Segment resolver that turns a Snapshot into ordered, unstyled Segment values.

### Exit criteria

- All default Segments have unit tests.
- Segment resolution has no I/O.
- Unknown configured Segment IDs produce actionable validation errors.

## 6. Phase 4 — Multi-row layout engine

### Tasks

- Implement row configuration.
- Implement left/right alignment.
- Implement row visibility.
- Implement priority-based fitting from built-in Segment defaults.
- Implement compact values.
- Implement width-aware truncation.
- Use the global separator; per-row separator overrides are not configurable.
- Add output invariants and width tests.

### Deliverable

A pure layout engine that can render arbitrary configured rows from synthetic Snapshots.

### Exit criteria

- Four-row configuration works.
- Width tests pass at 40/60/80/120 columns.
- Hidden Segments do not leave dangling separators.
- Required values are preserved whenever possible.

## 7. Phase 5 — Theme and style system

### Tasks

- Define semantic roles.
- Implement context threshold policy.
- Implement cache state policy.
- Implement provider quota state policy.
- Implement semantic and monochrome modes.
- Implement default text/dot style.
- Implement optional icons.
- Implement Powerline and ASCII fallback styles.
- Use Pi theme APIs rather than hard-coded color assumptions.

### Deliverable

A colored Footer renderer with a plain fallback.

### Exit criteria

- Color tests pass for all threshold boundaries.
- No Emoji or Powerline glyph appears in default output.
- Monochrome output is still understandable.
- ANSI sequences do not affect width calculations.

## 8. Phase 6 — Pi Footer and lifecycle integration

### Tasks

- Register the pure renderer through `ctx.ui.setFooter`.
- Connect Snapshot updates to redraw invalidation.
- Connect session/model/tool/turn events.
- Add shutdown disposal.
- Add conflict documentation.
- Verify behavior in TUI and non-TUI contexts.

### Deliverable

A working Footer replacement with local metrics and multi-row configuration.

### Exit criteria

- Pi session remains usable during data source failures.
- Footer redraws after relevant events.
- Shutdown leaves no active timers or pending requests.
- No private Pi APIs are imported.

## 9. Phase 7 — Provider usage adapters

### Tasks

- Implement common `ProviderUsageSnapshot` model.
- Implement usage cache and refresh manager.
- Implement current runtime auth resolution.
- Implement Codex adapter.
- Implement OpenCode Go adapter.
- Add official-origin validation.
- Add request timeout and cancellation.
- Add stale/error/unavailable states.
- Add `provider_usage` Segment.
- Add fixtures based on normalized provider responses.
- Review relevant MIT source and complete `NOTICE.md`.

### Deliverable

Built-in, optional-failure provider usage display for Codex and OpenCode Go.

### Exit criteria

- Both adapters pass fixture tests.
- Provider usage is only queried for the active supported provider by default.
- Late responses cannot overwrite newer session state.
- Credentials never appear in test snapshots or logs.
- `/xfooter refresh` can request a bounded refresh.

## 10. Phase 8 — Commands and configuration UX

### Tasks

- Implement `/xfooter` menu with preset-owned entries locked/grayed in built-in modes.
- Expand Layout, Segment, Context, and Label style details only in `custom` mode.
- Add a live plain-text Footer preview from the draft configuration.
- Support `←`/`→` cycling for enum and toggle values alongside `↑`/`↓` navigation.
- Implement `toggle`, presets, `refresh`, `status`, and `help`.
- Persist safe changes atomically.
- Add notifications for refresh success/failure without secrets.
- Add config reload behavior.
- Add command argument validation.

### Deliverable

Users can manage common settings without manually editing JSON.

### Exit criteria

- Invalid commands do not mutate config.
- Preset switching produces valid layouts.
- Refresh does not alter layout settings.
- Global preference edits do not force `custom` mode.
- Menu is usable at narrow widths and shows the current draft preview.

## 11. Phase 9 — Hardening and release

### Tasks

- Run all automated tests and type checks.
- Build and test the runtime bundle.
- Run the manual verification matrix.
- Review security and error redaction.
- Review upstream attribution.
- Complete README installation and configuration examples.
- Document Footer replacement conflicts.
- Tag `0.1.0` only after release gates pass.

### Deliverable

A publishable `pi-x-footer@0.1.0` package.

## 12. Suggested implementation order inside the codebase

```text
1. config/types.ts + defaults.ts
2. state/types.ts + store.ts
3. segments/types.ts + registry.ts
4. data/session.ts + context.ts + repository data
5. render/width.ts + render/theme.ts
6. layout/layout-engine.ts
7. render/renderer.ts
8. extension.ts integration
9. usage/types.ts + cache.ts + manager.ts
10. usage/providers/codex.ts
11. usage/providers/opencode-go.ts
12. commands.ts
13. package build and release files
```

## 13. Risk controls

| Risk | Mitigation |
|---|---|
| Footer renderer becomes too complex | Keep data, layout, and styling layers separate |
| Provider API changes | Normalize behind adapters and fixtures |
| Credentials sent to wrong origin | Validate effective origin before requests |
| Narrow terminals overflow | Test width fitting independently per row |
| Color becomes unreadable | Provide semantic labels and monochrome mode |
| Duplicate Footer extensions | Document and warn about conflicts |
| Duplicate usage polling | Keep usage manager bounded and document `pi-usage` coexistence |
| Config corruption | Validate before atomic replacement |
| Upstream license ambiguity | Record only verified attribution and avoid wholesale copying |

## 14. Definition of done for v0.1

- All `Must` requirements in the product spec are implemented.
- The default output is restrained and readable.
- Multi-row layouts are configurable without source changes.
- Colors communicate context/cache/quota state.
- Codex and OpenCode Go usage work through normalized adapters.
- Configuration and command behavior are documented and tested.
- No non-Footer features have leaked into the project.
- The package builds, loads, and passes the release gate.
