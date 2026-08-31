# Features

`pi-x-footer` replaces only Pi's Footer and leaves the editor, prompt queue, Bash mode, stash, and other UI areas unchanged.

## Footer content

The built-in Segments can show:

- Project path or folder name.
- Git branch and repository state, or a muted status when the project is not a Git repository.
- Active provider, model, and thinking level.
- Context usage and limit.
- Input/output tokens.
- Cache read/write and hit rate.
- Session cost with compact total, standard cached/uncached groups, or the full input/output/cache read/cache write breakdown.
- Independent Cost notation using arrows, short labels, or full labels.
- Active tools and extension status.
- Account-level Provider Usage when supported.

## Layout and presentation

- Configure multiple rows with independent left and right groups.
- Move Segments between rows or across the center line.
- Hide optional rows when their data is unavailable or empty.
- Compact, hide, or truncate content as the terminal becomes narrow.
- Use semantic state colors or a monochrome presentation.
- Keep Token and Cache zero values visible before the first usage record.

## Settings and commands

`/xfooter` provides searchable `General`, `Components`, `Layout`, and `Appearance` settings. Components expose per-Segment visibility, display, Cost notation, and label controls. Changes save immediately; Layout movement is previewed first and saved when confirmed.

Available commands:

```text
/xfooter
/xfooter toggle
/xfooter compact|balanced|detailed
/xfooter refresh
/xfooter status
/xfooter help
```

Cost density and notation are independent: choose `compact`, `standard`, or `full` display, then choose `arrows`, `short`, or `full` notation. For the complete setting map and configuration behavior, see [Settings UI](../specs/12-settings-ui-redesign.md) and [Configuration and commands](../specs/06-config-commands.md).
