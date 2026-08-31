# Open Decisions and Proposed Defaults

This document records decisions that do not block the overall architecture but should be settled before implementation reaches the affected phase.

## Confirmed planning decisions

The following decisions were confirmed before implementation begins:

- Provider Usage is built into `pi-x-footer` for OpenAI Codex and OpenCode Go.
- Custom/proxy Provider origins are not queried for Usage in v0.1.
- The default layout has two primary rows, a conditional Provider Usage row, and a conditional extension-status row.
- The minimum supported Pi version is the current `0.84.x` line; development verification targets Pi `0.84.3`.
- The package name is `pi-x-footer`, published without an npm scope, and uses MIT licensing. Repository/author metadata is finalized in the package scaffold.
- Segments are independent, freely placeable units: users can move any Segment up/down (between rows) and left/right (between groups), and rendering must be robust to any such arrangement.

## D-001: Default preset name

**Proposal:** `balanced`.

Reason: it demonstrates the product without showing every available metric.

## D-002: Default row count

**Proposal:** two primary rows, with provider usage and extension status as conditional rows.

Reason: multi-row is visible immediately, but optional rows do not create permanent empty space.

## D-003: Default color mode

**Proposal:** semantic colors.

Reason: context and quota state are core information, not decoration.

## D-004: Default icon mode

**Proposal:** `off`.

Reason: text labels are more portable and avoid visual noise. `minimal`, `nerd`, and `emoji` remain opt-in.

## D-005: Default separator

**Proposal:** `dot` using `·`.

Reason: readable without Nerd Font and visually lighter than Powerline blocks.

## D-006: Provider usage ownership

**Decision:** implement Codex and OpenCode Go adapters inside `pi-x-footer` in v0.1, while keeping the `/usage` management experience out of scope.

Reason: the relevant adapter code is small enough, and structured data is required for correct per-window coloring.

## D-007: Usage refresh interval

**Proposal:** five minutes, plus startup/model-change/turn-completion triggers with debounce.

Reason: provider quota is a snapshot and does not need per-token polling.

## D-008: Project configuration

**Decision:** support `.pi/pi-x-footer.json`, but read it only when the global opt-in is true.

Reason: avoids unexpected repository-local UI changes while preserving team/project customization.

## D-009: Template language

**Proposal:** do not implement in v0.1.

Reason: explicit rows and Segment references cover the core use case and are easier to validate responsively.

## D-010: Custom Segment API

**Proposal:** internal registry only in v0.1; keep the registry extensible for a later public API.

Reason: arbitrary extension loading and lifecycle ownership need a separate design.

## D-011: Provider usage when `pi-usage` is installed

**Decision:** allow coexistence and document possible duplicate polling. Do not make `pi-x-footer` depend on `pi-usage`.

A future version may define a structured handoff protocol, but v0.1 should prioritize a self-contained Footer.

## D-012: Cost threshold colors

**Proposal:** no warning/error threshold by default. Use a neutral accent unless the user configures a budget.

Reason: cost meaning varies by provider and user plan.

## D-013: Cache miss color

**Proposal:** muted/dim, not error.

Reason: a first request or uncached prompt is normal and should not look like a failure.

## D-014: Extension status parsing

**Proposal:** render generic statuses as text only. Do not infer structured quota values by parsing arbitrary status strings.

Reason: text statuses are not a stable data contract.

## D-015: Attribution scope

**Proposal:** reimplement where practical; copy/adapt only focused algorithms with verified MIT provenance, and record them in `NOTICE.md`.

Reason: keeps the project maintainable and avoids inheriting unrelated features.

## D-016: Provider endpoint policy

**Decision:** do not query Usage for custom or proxy Provider origins in v0.1.

Reason: runtime credentials must only be sent to validated official Provider endpoints.

## D-017: Pi compatibility baseline

**Decision:** target the current Pi `0.84.x` line, with Pi `0.84.3` as the development verification version.

Reason: this is the API line inspected during design and keeps the first implementation focused.

## D-018: Package identity

**Decision:** use the unscoped npm package name `pi-x-footer` and MIT licensing. Final repository and author metadata will be added during package scaffolding.

## D-019: Preset locking and custom detail mode

**Decision:** built-in presets are read-only in the settings UI. Preset-owned entries remain visible but grayed out; selecting one offers to switch to `custom`. Custom mode seeds from the selected preset and expands the editable layout and Segment display details.

Global preferences such as enabled state, colors, icons, separators, thresholds, responsive strategy, Provider Usage, and project overrides remain editable without leaving a preset.

## D-020: Small Segment configuration surface

**Decision:** per-Segment configuration is limited to `enabled`, `label`, and a small number of content-specific display options. Per-Segment format, priority, requiredness, visibility, color role, emphasis, and minimum width are removed. Formatting detail is controlled by the global `style.labelMode`; priority and requiredness are built-in defaults.

Row references are plain Segment IDs. Per-reference override objects are not supported. Rows inherit the global separator; per-row separator overrides are removed.

## D-021: Live settings preview and arrow cycling

**Decision:** every TUI settings list shows a live plain-text Footer preview built from the draft configuration. Supported enum and toggle rows can be changed with `←`/`→`; `↑`/`↓` remain navigation keys. The active Footer is not mutated until the settings draft is committed.

## D-022: Settings usability corrections

**Status:** superseded by the confirmed target design in [12-settings-ui-redesign.md](./12-settings-ui-redesign.md); not yet implemented.

The settings inventory found several UX issues: `density` currently has no rendering effect; icons are suppressed in labeled/detailed formats; `ascii` and `powerline` separators currently render the same as `bar`; and wizard input paths do not consistently reuse schema validation.

## D-023: Settings UI reorganization

**Decision:** reorganize `/xfooter` around user-visible information blocks rather than internal modules: Mode, Footer, Appearance, Project, Git, Models & Providers, Usage, Context, Cache, Tokens, Cost, and Layout. Preset mode shows these categories read-only; Custom mode makes them editable. Layout uses a two-column canvas; Position, Advanced/More, Provider management, and maximum Usage window count remain out of scope.

**Interaction:** Every settings page keeps a focused search input like native `/model`; typing fuzzy-filters settings, Enter opens or immediately validates/saves a concrete value, and Esc returns to the previous level. The Custom Layout page is a spatial canvas: arrows traverse, Enter picks a Segment, `↑`/`↓` move rows, `←`/`→` reorder within the current half, and `l`/`r` move it across the center line; a second Enter confirms the placement. `n` inserts a row and `x` clears a row. There is no Apply/Discard draft transaction outside this explicit placement confirmation.

**Fixed choices:** Context precision is limited to 0/1/2 decimals. Usage refresh is limited to 15s/30s/1m/2m/5m/10m/15m, with 30s as the default. Usage window visibility (`5h` / `week` / `month`) and reset visibility are independent settings; Usage Display is limited to compact/standard/detailed.
