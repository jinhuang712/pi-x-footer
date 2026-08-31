# Product Specification

## 1. Product definition

`pi-x-footer` is a focused Pi extension that replaces the default Footer with a configurable, information-dense, readable Footer.

It should answer four questions without opening a menu:

1. What project and branch am I working in?
2. Which provider, model, and thinking level are active?
3. How much of the current context and session budget is being used?
4. Is the active provider approaching an account-level usage limit?

## 2. Goals

### G-1: Multi-row layout

Users MUST be able to configure any practical number of Footer rows. A row MUST support independent left/right content and visibility rules.

### G-2: Useful information at a glance

The default layout SHOULD show project identity, active model, context usage, token/cache information, cost, and supported provider usage without decorative noise.

### G-3: Semantic visual feedback

The Footer MUST use color to communicate states such as safe, warning, exhausted, stale, unavailable, cache hit, and cache miss. It MUST remain understandable in monochrome mode.

### G-4: Responsive behavior

The Footer MUST fit each row to the available terminal width. It MUST hide or compact low-priority values before truncating required values.

### G-5: Provider usage

v0.1 MUST support account-level usage snapshots for:

- OpenAI Codex.
- OpenCode Go.

Provider usage failures MUST not break the Pi session or the local Footer metrics.

### G-6: Footer-only scope

The extension MUST NOT modify the editor, prompt submission, Bash mode, queue, stash, welcome screen, or unrelated widgets.

## 3. Non-goals for v0.1

- General-purpose template language.
- Arbitrary user TypeScript Segment plugins.
- GitHub Copilot or OpenRouter account usage.
- Codex Fast mode or Codex reset operations.
- Provider account switching.
- Cloud synchronization of configuration.
- Persistence of credentials or raw provider responses.

## 4. Primary user scenarios

### S-1: Default use

After installing the extension, the user sees a four-row Footer with no required configuration (plus conditional rows when data exists). The default uses the current Custom profile: full Project path, full Git details, Full Context, Standard Tokens, compact Cache, detailed Provider Usage with reset countdowns, `5h` and weekly windows, text labels, ordinary separators, semantic colors, and a 30-second refresh interval.

### S-2: Configure multiple rows

The user edits `~/.pi/agent/pi-x-footer.json` and adds or reorders rows. The next Footer render uses the new layout after validation and reload.

### S-3: Narrow terminal

When the terminal becomes narrow, optional segments disappear or compact themselves. The model and context usage remain visible whenever possible.

### S-4: Context warning

As context usage crosses configured thresholds, the context Segment changes from success to warning to error.

### S-5: Cache state

When the provider reports cache reads, the cache Segment shows a positive/accent state. A normal cache miss is shown as muted or warning, not as a fatal error.

### S-6: Codex usage

When the active provider is OpenAI Codex and usage data is available, the Footer shows relevant usage windows such as `5h` and `wk`, each with an independent state color.

### S-7: OpenCode Go usage

When the active provider is OpenCode Go, the Footer maps its rolling window to the normalized `5h` window and shows weekly and monthly usage when returned by the provider.

### S-8: Project configuration opt-in

A repository may contain `.pi/pi-x-footer.json`, but the file is ignored unless the global setting explicitly enables project overrides.

## 5. Default user-facing layout

The exact model name and values vary, but the default shape is:

```text
project  main                         openai-codex: gpt-5.6 (xhigh)
git  dirty                             Context: 272k × 18.9%
Usage: Codex 59% 5h · 61% wk             Cost: $0.033 · cache $0.008 · no-cache $0.025
Tokens: ↓108k ↑4.9k                              Cache: 268k
```

The provider usage row is hidden when no supported snapshot exists. Extension statuses are also hidden when empty. The default identity display combines provider, model, and thinking as `provider: model (thinking)` because that form is self-explanatory; a separate labeled layout remains configurable. A fresh installation starts in `custom` mode with the documented current default profile: full project path, full Git details, Full Context, Standard Tokens, compact Cache, detailed Provider Usage with reset countdowns, `5h` and weekly windows, and a 30-second refresh interval.

The default MUST NOT contain Emoji or Powerline separators. A user MAY enable them through configuration.

## 6. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Replace the Pi Footer through the public Footer API. | Must |
| FR-002 | Support arbitrary configured rows. | Must |
| FR-003 | Support left and right alignment per row. | Must |
| FR-004 | Support row and Segment visibility rules. | Must |
| FR-005 | Render context, tokens, cache, cost (total and configured breakdown), model, provider, thinking, CWD, and Git. | Must |
| FR-006 | Render Codex and OpenCode Go account usage. | Must |
| FR-007 | Apply semantic colors to local and provider usage. | Must |
| FR-008 | Fit content responsively per row. | Must |
| FR-009 | Provide global JSON configuration. | Must |
| FR-010 | Support project configuration with an opt-in gate. | Must |
| FR-011 | Provide `/xfooter` configuration and refresh commands. | Should |
| FR-012 | Provide compact, balanced, and detailed presets. | Should |
| FR-013 | Degrade to monochrome and plain ASCII safely. | Must |
| FR-014 | Avoid blocking the Pi event loop with data collection. | Must |
| FR-015 | Cleanly cancel timers and requests at shutdown. | Must |

Cost uses four additive components: input, output, cache read, and cache write. Its Compact, Standard, and Full displays expose 1, 3, and 5 values respectively: Total; Total plus Cache/No Cache groups; or Total plus all four components.

## 7. Success criteria

A v0.1 release is successful when:

- A user can configure at least three independent rows without source changes.
- The Footer remains readable at common widths such as 40, 80, and 120 columns.
- Context and provider usage colors are correct at threshold boundaries.
- A failed usage request does not affect model requests or local metrics.
- Codex and OpenCode Go fixtures render without credentials in tests.
- No non-Footer Pi behavior is modified.
