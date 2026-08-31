# Testing and Acceptance Specification

## 1. Test layers

### Unit tests

Pure modules MUST have unit tests:

- Config defaults, normalization, validation, migration, and merge.
- Segment metadata completeness and field validation.
- Segment formatting.
- Semantic state classification.
- Visible-width measurement.
- Row alignment.
- Responsive fitting.
- Truncation.
- Usage response normalization.
- Usage cache expiration and stale state.
- Settings-menu live preview rendering from a draft configuration.

### Integration tests

Use a mocked Pi context to verify:

- Footer registration through `ctx.ui.setFooter`.
- Lifecycle events update the Snapshot.
- `/xfooter` commands validate and persist changes.
- Provider refresh updates only provider usage data.
- Shutdown cancels requests and timers.

### Fixture tests

Provider adapters MUST use checked-in JSON fixtures for at least:

- Normal Codex response.
- Codex response with multiple windows.
- Codex model-specific bucket.
- OpenCode Go rolling/weekly/monthly response.
- Missing optional fields.
- Provider error response.
- Malformed response.
- Expired/stale data.

No real credentials or live provider requests may be used in automated tests.

### Snapshot/render tests

Render snapshots SHOULD cover widths:

```text
40
60
80
120
```

And styles:

```text
semantic color
monochrome
icons off
icons on
plain separator
powerline separator with fallback
```

Configuration menu tests SHOULD follow the information architecture in [12-settings-ui-redesign.md](./12-settings-ui-redesign.md), which supersedes the older flow list below for the current implementation:

```text
root menu → category → value change (Enter saves immediately)
preset root → read-only category → Esc back
root menu → Mode → another preset (resets preset-owned settings)
root menu → Usage → Windows → per-window Visible/Hidden
root menu → Usage → Resets → On/Off
root menu → Usage → Display → Compact/Standard/Detailed
segment toggle in Custom mode → auto-placement/removal from default Rows
enum row → ←/→ cycle value
Esc at root → leave wizard; e → leave wizard
```

Legacy coverage that still applies where noted:

```text
preset selection → custom edit
context submenu → percentage selection
enum row → ←/→ cycle value
```

## 2. Required acceptance criteria

### Layout

- A user can define four independent rows through JSON.
- Custom-menu Segment changes add enabled Segments to their default Row and remove hidden Segments from all Rows.
- Custom-menu layout changes can move a Segment between Rows and left/right groups without duplicating it.
- Confirmed Layout moves remove an emptied source Row and compact later Rows upward; temporary Rows created during editing never persist.
- An idle Layout canvas exits the settings wizard on `Esc`; `Esc` while moving cancels only the pending move.
- Each row can have left and right groups.
- An empty conditional row is omitted.
- The enabled Token/Cache session row remains visible before the first assistant response with zero values.
- A row does not overflow its width after optional values are removed.
- Required values survive normal responsive fitting.

### Presentation

- Balanced and detailed presets use readable labels rather than unexplained one-letter abbreviations.
- Every supported Segment setting has a representative preview.
- Labels, values, secondary values, and statuses render with distinct semantic roles.
- Input/output, cache read/write/hit, Cost total/group/component breakdowns, Context percentage/limit, and Provider Usage windows remain distinguishable.

### Colors

- Context threshold boundaries produce expected semantic states.
- Cache hit, miss, unavailable, and error are distinguishable; the unavailable initial state renders muted zero counters when Cache is enabled.
- Provider usage windows are colored independently.
- Monochrome mode remains readable.

### Provider usage

- Codex usage normalizes into the common snapshot model.
- OpenCode Go usage normalizes into the common snapshot model.
- A timeout shows stale or unavailable state and does not throw from rendering.
- A model/account change prevents a late response from being displayed for the wrong session.
- No secret appears in logs, errors, snapshots, or rendered output.

### Configuration

- The `/xfooter` flow is hierarchical rather than a linear questionnaire.
- The root menu shows a live plain-text Footer preview of the current configuration that updates after each confirmed change, together with a short Saved status line.
- Mode and category choices include representative summaries.
- Preset mode keeps every content category read-only; only `Mode` and `Footer` stay editable until the user confirms a switch to Custom.
- Built-in presets are immutable; selecting one replaces preset-owned settings immediately and persists on Enter.
- Context display settings cover visibility, limit visibility, used/remaining/hidden percentage, fixed precision tiers, and thresholds.
- Provider Usage settings cover enabled state, Detail (`compact/standard/detailed`), selected `5h`/`week`/`month` windows, independent reset visibility, alert thresholds, and fixed refresh tiers; providers are auto-detected from the active model and the default refresh tier is 30 seconds.
- Missing configuration uses valid defaults.
- Every supported configuration field is representable in JSON and the TUI settings menu, including Cost Display and Notation.
- Unknown or unsupported fields - including removed per-Segment fine-grained fields - produce actionable diagnostics without breaking the config.
- Preset selection resets the complete preset-owned configuration; custom mode can override every supported built-in field.
- Every preset selector contains no more than four choices; Usage Display contains exactly three choices.
- Malformed configuration does not destroy the previous valid file.
- Project configuration is ignored when the global opt-in is false.
- `/xfooter refresh` does not mutate layout configuration.
- Unknown command arguments do not write files.

### Scope

- No editor behavior changes.
- No prompt queue behavior changes.
- No Bash mode behavior changes.
- No welcome overlay or unrelated widget behavior.

## 3. Manual verification matrix

Before release, verify manually:

| Environment | Checks |
|---|---|
| 40-column terminal | fitting and required values |
| 80-column terminal | default balanced layout |
| 120+ column terminal | full multi-row layout |
| No Nerd Font | fallback separators/icons |
| Monochrome terminal | semantic text remains clear |
| No Git repository | Git Segment shows a muted no-repository status |
| Unsupported provider | provider usage hidden |
| Codex account | usage windows and refresh |
| OpenCode Go account | rolling/weekly/monthly windows |
| Provider request failure | stale/error behavior |
| Project config disabled | project file ignored |
| Project config enabled | project override applied |
| Competing Footer extension | documented conflict behavior |

## 4. Release gate

Do not publish v0.1 until:

- Typecheck passes.
- Formatting/lint checks pass.
- Unit and integration tests pass.
- Runtime bundle builds successfully.
- Manual width/style checks pass.
- LICENSE and NOTICE are present and accurate.
- README documents installation, conflict rules, provider usage, and security limitations.
