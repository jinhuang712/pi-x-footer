# Color, Theme, Icon, and Style Specification

## 1. Principles

Color is semantic data presentation. It MUST communicate state without requiring Emoji, Powerline blocks, or a particular font.

The renderer MUST use Pi's public theme/color facilities where available and MUST provide a safe plain-text fallback.

## 2. Semantic roles

The internal theme model SHOULD expose these roles:

Segment presentation MUST distinguish label, value, secondary value, and status parts. A whole Segment MUST NOT receive one uniform color when it contains multiple semantic parts.

```text
text
muted
dim
accent
info
success
warning
error
```

Default presentation mapping:

```text
label          dim
primary value  text/accent
secondary      muted
normal Git     success
warning value  warning
error value    error
provider       accent
input tokens   info
output tokens  accent
cache hit      success
```

Segments return semantic state; the theme maps state to colors. Segment implementations MUST NOT hard-code terminal color escape sequences.

## 3. State policies

### Context usage

Context thresholds MUST be configurable. Defaults remain warning at 70 and error at 90.

```text
unknown           muted
0% - 69.99%       success
70% - 89.99%      warning
90% - 100%        error
above 100%        error
```

Thresholds MUST be configurable globally and MAY be overridden per Segment. The documented values remain the defaults.

### Cache

```text
cache read > 0    accent or success
cache miss         dim or muted
cache unsupported muted/hidden
cache error        warning
```

A cache miss is not automatically an error. The visual treatment SHOULD distinguish "no reusable cache" from "cache request failed".

### Cost

Cost SHOULD use a neutral accent by default. A future budget policy MAY color cost against a user-defined budget. v0.1 MUST NOT invent a budget or label a cost as dangerous without a configured threshold.

### Provider quota

The normalized value is `usedPercent`:

```text
unknown            muted
0% - 69.99%        success
70% - 89.99%       warning
90% - 100%         error
expired            error
loading            dim
stale              warning
unavailable        muted
```

Each usage window is colored independently.

### Tool and extension status

```text
active tool        info/accent
normal status      text
warning status     warning
error status       error
stale status       muted/warning
```

## 4. Color modes

```json
{
  "style": {
    "colorMode": "semantic"
  }
}
```

Supported modes:

- `semantic`: default; applies state colors.
- `monochrome`: no semantic colors, preserves text and separators.
- `auto`: future-compatible option that follows terminal capability detection.

If color is unavailable, the Footer MUST remain understandable using labels and text.

## 5. Typography and labels

The Footer cannot change the terminal font family. Semantic parts own their roles; per-Segment color and emphasis overrides are not configurable.

`brief`, `labeled`, and `detailed` are presentation modes driven by the global `style.labelMode`, not arbitrary templates.

## 6. Icons

Default:

```json
{
  "style": {
    "icons": "off"
  }
}
```

Optional modes:

```text
off
minimal
nerd
emoji
```

The default MUST NOT render decorative Emoji. Icon changes MUST NOT alter the underlying Segment identity or state.

## 7. Powerline style

Powerline separators are an optional visual style, not a layout requirement:

```json
{
  "style": {
    "separator": "powerline",
    "icons": "nerd"
  }
}
```

If the configured glyph cannot be displayed or the terminal lacks the expected font, the renderer MUST fall back to `dot` or `ascii`.

## 8. Accessibility

- Important values MUST have textual labels or recognizable abbreviations.
- Color MUST never be the only representation of warning/error state when a short textual representation is practical.
- `ctx`, `in`, `out`, `cache`, and `cost` are acceptable compact labels.
- A monochrome screenshot MUST remain interpretable.
- Error and stale states SHOULD have a suffix or status marker when color is disabled.

## 9. Theme configuration

v0.1 SHOULD allow selecting a named style/theme preset. Arbitrary color parsing MAY be deferred until the basic semantic theme is stable.

A future custom theme may look like:

```json
{
  "theme": {
    "success": "green",
    "warning": "yellow",
    "error": "red",
    "muted": "gray"
  }
}
```

The implementation MUST validate custom values and fall back safely.
