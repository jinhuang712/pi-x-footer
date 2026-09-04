# Multi-row Layout and Rendering Specification

## 1. Layout model

A Footer is an ordered list of configured rows. Each row has an independent left and right group.

```ts
interface FooterRowConfig {
  id: string;
  left?: SegmentId[];
  right?: SegmentId[];
  visible?: VisibilityRule;
  overflow?: OverflowPolicy;
}
```

Row references are plain Segment IDs. Per-reference option objects are not accepted; formatting detail belongs to the global `style.labelMode` and responsive priority/requiredness to the built-in defaults table. v0.1 SHOULD NOT become a template language.

Segments are independent, freely placeable units. Any Segment ID MAY appear in any row, in either the left or the right group: moving a Segment up/down is expressed by which row it appears in, and moving it left/right is expressed by the left/right group. Rendering MUST be robust to any such arrangement — a row with only a right group, a row whose left group resolves empty, or a row with content on both sides MUST NOT produce a lopsided or broken line.

## 2. Layout resolution pipeline

For each Footer render:

1. Read the latest immutable Snapshot.
2. Select the active preset/layout.
3. Resolve each configured Segment.
4. Remove empty or hidden Segments. Enabled `tokens` and `cache` Segments resolve muted zero values before the first local usage record, so their configured session row remains renderable.
5. Render semantic values without terminal styling.
6. Measure visible width, excluding ANSI/control sequences.
7. Fit each row independently.
8. Apply colors, icons, and separators.
9. Return the final Pi TUI component/lines.

## 3. Alignment

For a row with both groups:

```text
left content                         right content
```

The gap is calculated from the available width. Hiding MUST preserve the configured two-sided structure while truncation can still fit: the hide pass MUST NOT remove the last Segment of an initially non-empty group while the other group still has content (for example, a long project path MUST truncate rather than vanish when the model name is also long). Falling back to a single-group layout by emptying a group is allowed only as the final fallback, when even truncated content cannot fit the terminal width.

A row whose left group resolves empty but whose right group has content remains a right-aligned row. Its content is not moved into another configured row: row boundaries and left/right placement remain faithful to the layout configuration. Rows with no resolved content are omitted, so unavailable conditional Segments do not create empty lines.

The renderer MUST NOT emit negative-width padding or malformed control sequences.

## 4. Visibility rules

Supported v0.1 rules:

```text
always
when-available
when-nonempty
when-streaming
when-provider-supported
when-state-is-warning
```

A row with no visible Segment is omitted. The default session row is not empty before the first assistant response because enabled `tokens` and `cache` Segments render muted zero values. Empty rows MUST NOT create blank Footer lines unless a future explicit `preserveEmptyRow` option is added. The Layout editor may use empty rows as temporary move targets, but a confirmed edit MUST remove empty rows (and duplicate Segment placements) before persistence.

## 5. Responsive fitting algorithm

For each row:

1. Try the full resolved row.
2. Apply the configured responsive strategy. `hide-compact-truncate` hides optional values first, `compact-hide-truncate` tries each Segment's compact value first, and `truncate` tries safe truncation first.
3. Remove optional Segments from lowest priority to highest priority when the current strategy still cannot fit, without emptying an initially non-empty left/right group while the other group still has content.
4. Replace values with the automatically resolved compact format where available. The `cwd` compact value is the project basename even when the configured display is the full path, so fitting preserves the project name.
5. Apply configured truncation to path/model/branch values.
6. Render only the usage windows selected in the Usage settings; the Usage Segment may compact its selected values when space is limited.
7. Truncate the least important remaining non-required Segment.
8. As a final fallback, render required Segments only; only here may hiding empty an initially non-empty group to meet the terminal width.

The registry precomputes `compactText` by resolving the same built-in Segment with the internal compact format. Renderers and layout code never perform I/O while creating this fallback. A row-level `compact` or `truncate` overflow policy takes precedence over the global strategy; the default row-level `hide` policy inherits the global strategy.

Required Segments SHOULD be preserved, but the implementation MUST still cap output to terminal width. If even required content cannot fit, the final text may be truncated safely.

## 6. Priority defaults

```text
100  model, context
 85  provider_usage, provider, cwd
 70  git, cost
 60  tools
 55  tokens
 45  cache
 40  thinking
 20  extensions
```

Priority and requiredness are built-in defaults and are not user-configurable.

## 7. Truncation

The following values may be truncated:

- CWD: preserve the final path component and project name.
- Git branch: preserve the beginning and final distinguishing suffix where possible.
- Model: preserve the provider-visible model identifier or configured short name.
- Extension status: truncate at the end.

Truncation MUST use visible terminal width and MUST not split a multi-column glyph incorrectly.

## 8. Separators

Default:

```text
·
```

Optional styles:

```text
none
 dot
bar
slash
powerline
ascii
```

Powerline separators and Nerd Font icons are opt-in. The renderer MUST have an ASCII/plain fallback.

## 9. Render invariants

- Rendering is deterministic for the same Snapshot, config, theme, and width.
- Rendering performs no network, filesystem, child-process, or Git operations.
- Every emitted line has visible width no greater than the requested width, except when the TUI API itself imposes a different contract.
- A hidden Segment cannot leave a dangling separator.
- A row cannot affect the fitting decision of another row.
- ANSI color changes do not affect width calculations.

## 10. Acceptance examples

At wide width:

```text
Project: project                  openai-codex: gpt-5.6 (xhigh)
Git: main · dirty                 Context: 175k/272k (64.4%)
Usage: Codex 59% 5h · 61% wk       Cost: $0.123 · cache $0.028 · no-cache $0.095
Tokens: ↓108k ↑4.9k                            Cache: 268k
```

At narrow width:

```text
main                 gpt-5.6 (xhigh)
codex 59% 5h         ctx 64.4%/272k
cache 268k           $0.123
```

The exact textual shortening may vary, but `model`, `context`, and at least one relevant provider usage window SHOULD remain when available. Before the first assistant response, the session row remains visible with muted zero Token/Cache values. The Custom default and Balanced/Detailed presets use the four-row canvas pairing Project/Provider, Git/Context, Usage/Cost, and Token/Cache; Compact uses a two-row overview/session layout. Users may move any Segment between rows and left/right groups from the Layout canvas. The default identity presentation is collapsed (`provider: model (thinking)`); users may select separate provider, model, and thinking Segments from Layout settings.
