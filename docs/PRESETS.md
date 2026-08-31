# Presets

## Footer modes

The Footer has four modes:

| Mode | Purpose |
| --- | --- |
| `compact` | Two-row summary with only high-signal values |
| `balanced` | Recommended four-row balance of detail and width |
| `detailed` | Four rows with more absolute values and status detail |
| `custom` | User-controlled layout and Segment settings |

`compact`, `balanced`, and `detailed` are immutable built-in presets. Compact uses a two-row overview/session layout; Balanced and Detailed share the default four-row structure. They each own their layout and Segment presentation. A fresh installation starts in `custom` with the current default profile. Selecting `custom` is also the entry point for editing Layout and Components settings.

Use `/xfooter compact`, `/xfooter balanced`, or `/xfooter detailed` to apply a mode. The interactive settings menu can switch modes under `General → Mode`.

## Layout by mode

Compact groups orientation and identity on the first row, then Provider Usage and session metrics on the second row:

```text
Project · Git                         Identity · Context
Usage                                 Tokens · Cache · Cost
```

Balanced and Detailed keep the stable four-row layout:

```text
Project                                Identity
Git                                    Context
Usage                                  Cost
Tokens                                 Cache
```

The modes differ in Segment display detail rather than changing the meaning of these positions. Optional Extensions remain conditional.

## Segment detail

| Segment | Compact | Balanced | Detailed |
|---|---|---|---|
| Project | name | path | path |
| Git | status | status | full |
| Context | compact | hybrid | full |
| Tokens | compact | standard | full |
| Cache | compact | read/write/hit | read/write/hit |
| Provider Usage | compact | standard | detailed |
| Cost | compact | standard | full |

## Cost display levels

Cost density is independent from the global label style. The three presets expose one, three, or five values:

| Display | Values | Example |
| --- | --- | --- |
| `compact` | Total | `Cost: $0.123` |
| `standard` | Total, Cache, No Cache | `Cost: $0.123 · cache $0.028 · no-cache $0.095` |
| `full` | Total, Input, Output, Cache In, Cache Write | `Cost: $0.123 · in $0.012 · out $0.083 · read $0.025 · write $0.003` |

Cost notation is selected separately. `short` uses `in/out/read/write`, `full` uses semantic labels, and `arrows` produces compact directional values such as `↓$0.012 · ↑$0.083 · ←$0.025 · →$0.003`. Compact and Balanced use short notation by default; Detailed uses full notation. Custom mode can change notation without changing density.

## Usage display levels

The `provider_usage` Segment supports three display detail levels:

| Display | Style |
| --- | --- |
| `compact` | Percentages only |
| `standard` | Provider name, window labels, and percentages |
| `detailed` | Standard values with reset countdowns when enabled |

Window selection (`5h`, `Week (7d)`, `Month (30d)`) and reset visibility are configured independently under `/xfooter → Components → Usage`.

For the full configuration schema and rendering examples, see [Configuration and commands](../specs/06-config-commands.md), [Layout and rendering](../specs/03-layout-rendering.md), and [Settings Effects Manual](../specs/11-settings-design.md).
