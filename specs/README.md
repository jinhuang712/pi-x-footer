# pi-x-footer Specifications

Status: Draft for implementation planning

## Purpose

This directory contains the product specification, technical design, acceptance criteria, and staged implementation plan for `pi-x-footer`.

The project is a Footer-only Pi extension. Its differentiators are:

- Explicit, user-configurable multi-row layout.
- Responsive fitting that preserves important information.
- Semantic colors for context, cache, cost, and provider quota state.
- Built-in Provider Usage monitoring for OpenAI Codex and OpenCode Go.
- A deliberately restrained visual style: no decorative Emoji or Powerline glyphs by default.

## Reading order

1. [00-product-spec.md](./00-product-spec.md) — product scope and user-facing requirements.
2. [01-architecture.md](./01-architecture.md) — runtime architecture and module boundaries.
3. [02-data-model-segments.md](./02-data-model-segments.md) — state, data providers, and Segment contracts.
4. [03-layout-rendering.md](./03-layout-rendering.md) — multi-row layout and responsive rendering.
5. [04-color-themes.md](./04-color-themes.md) — colors, styles, icons, and accessibility.
6. [05-provider-usage.md](./05-provider-usage.md) — Codex and OpenCode Go usage monitoring.
7. [06-config-commands.md](./06-config-commands.md) — configuration files, presets, and `/xfooter`.
8. [07-lifecycle-performance-security.md](./07-lifecycle-performance-security.md) — lifecycle, performance, privacy, and conflicts.
9. [08-testing-acceptance.md](./08-testing-acceptance.md) — test strategy and release gates.
10. [09-implementation-plan.md](./09-implementation-plan.md) — phased implementation plan.
11. [10-open-decisions.md](./10-open-decisions.md) — decisions that should be confirmed before or during implementation.
12. [11-settings-design.md](./11-settings-design.md) — user-facing mapping from each setting to its rendered Footer effect.
13. [12-settings-ui-redesign.md](./12-settings-ui-redesign.md) — confirmed target information architecture and interaction model for the settings UI.

## Normative language

- **MUST**: required for v0.1.
- **SHOULD**: expected unless there is a documented reason not to do it.
- **MAY**: optional or future-compatible behavior.

## Decisions already made

- `pi-x-footer` replaces only the Footer through `ctx.ui.setFooter(...)`.
- Multi-row layout is a first-class feature, not a later enhancement.
- Default style uses text, semantic colors, and ordinary separators; Emoji and Powerline are opt-in.
- Color is part of the information model, not only decoration.
- Local session usage and provider account usage are separate concepts.
- v0.1 includes OpenAI Codex and OpenCode Go usage adapters.
- Project configuration is supported but disabled by default.
- v0.1 does not include editor customization, Bash mode, queue, stash, welcome overlay, or Working Vibes.
- v0.1 does not include a general-purpose template language or arbitrary TypeScript Segment API.
- If upstream MIT code is copied or materially adapted, `NOTICE.md` and attribution MUST be added.

## Reference material

The design was based on the inspected implementations and documentation in:

- `~/dev/open-source/pi-extensions/packages/pi-statusline`
- `~/dev/open-source/pi-extensions/packages/pi-usage`
- `~/dev/open-source/pi-powerline-footer`
- Pi Extension API and TUI documentation installed with the current Pi runtime.
