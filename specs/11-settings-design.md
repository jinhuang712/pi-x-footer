# Settings Effects Manual

Status: User-facing effects reference
Scope: `/xfooter` 设置菜单中的每一项设置，以及它会让 Footer 变成什么样

这份文档只回答一个问题：

> **我改这个设置，Footer 会怎么变？**

不展示底层配置文件，不解释内部 schema。

---

## 1. 示例使用的固定状态

除非特别说明，示例都基于同一个会话状态：

```text
Provider: openai-codex
Model: gpt-5.6-luna
Thinking: xhigh
Project: project
Git: main, dirty
Context: 175k / 272k, 64.4%
Tokens: input 901k, output 63k
Cache: read 19.7m, write 0, hit 99.3%
Cost: total $0.123, input $0.012, output $0.083, cache read $0.025, cache write $0.003
Codex Usage: 58% (5hr), 9% (7d)
```

颜色在文档中用文本标记表示：

```text
[green]  正常 / 成功
[yellow] 警告
[red]    错误
[dim]    弱化信息
```

实际 Footer 中会使用终端主题颜色。

---

## 2. 设置效果速查表

| 设置菜单位置 | 设置 | 改了以后会发生什么 |
|---|---|---|
| Root | Enable Footer | 整个自定义 Footer 显示或消失 |
| Root | Mode | 一次性切换整套布局和详细程度 |
| Root → Appearance | Label style | 控制每个信息项显示得多详细 |
| Root → Appearance | Color | 控制使用颜色还是纯文本状态标记 |
| Root → Appearance | Icons | 给部分信息项添加图标；当前默认 Balanced 下看不到效果 |
| Root → Appearance | Separator | 改变同一行多个信息项之间的分隔符 |
| Root → Appearance | Density | **当前没有任何效果** |
| Root → Layout | Identity | 切换合并身份或分开显示 Provider/Model/Thinking |
| Root → Layout | Row settings | 控制某一行什么时候显示、超宽时怎么处理 |
| Root → Segments | Enabled | 显示或隐藏某一个信息项 |
| Root → Segments | Label | 修改信息项前面的文字标签 |
| Root → Context | Percentage | 显示已用、剩余，或隐藏百分比 |
| Root → Context | Context limit | 是否显示 Context 上限 |
| Root → Context | Used tokens | 详细模式下是否显示 `175k/272k` |
| Root → Cost | Display | 在 Compact / Standard / Full 三档成本信息密度之间切换 |
| Root → Cost | Notation | 选择箭头、短标签或完整成本标签 |
| Root → Usage | Show Usage | 是否查询并显示账号额度 |
| Root → Usage | Display | 在 `compact / standard / detailed` 三档信息密度之间切换 |
| Root → Usage | Windows | 独立选择 5h、Week (7d)、Month (30d) |
| Root → Usage | Resets | 独立开启或关闭 reset 倒计时 |
| Root → Usage | Refresh | 控制额度数据刷新频率，默认 30 秒 |
| Root → Responsive & thresholds | Strategy | 控制终端变窄时先隐藏、压缩还是截断 |
| Root → Responsive & thresholds | Thresholds | 控制什么时候变黄、变红 |
| Root | Project Overrides | 是否允许当前项目覆盖全局设置 |

---

# 3. Mode：整体模式

Mode 是最重要的设置。它会一次改变整套布局和信息密度。

## 3.1 Compact

效果：使用两行布局，并将信息块压缩为最简洁的 brief 格式。Provider Usage 无数据时仍不会产生空行。

```text
Project: project · Git: main          openai-codex: gpt-5.6-luna · Context: 64.4%
Usage: 58% (reset 4h) · 9%             Tokens: 964k · Cache: 99.3% · Cost: $0.123
```

适合：希望用最少行数保留核心信息。

---

## 3.2 Balanced

效果：使用稳定的四行布局，Provider Usage 使用标准信息密度。默认显示 5h / Week 窗口；reset 是否显示由独立的 Resets 设置控制。

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh) · Context: 64.4%
Usage: Codex 58% (5hr, reset 4h) · 9% (7d, reset 7d)
Tokens: ↓901k ↑63k · Cache: read 19.7m · hit 99.3%   Cost: $0.123 · cache $0.028 · no-cache $0.095
```

适合：默认推荐，信息完整但不过度展开。

---

## 3.3 Detailed

效果：和 Balanced 使用同一行布局，但 Git、Context、Tokens、Cache 和 Usage 显示更多细节。Usage 的 reset 使用完整的相对倒计时表达。

```text
Project: project · Git: main · dirty (2)    openai-codex: gpt-5.6-luna (xhigh) · Context: 175k/272k (64.4%)
Usage: Codex 58% (5hr resets in 3hr53m) · 9% (7d resets in 6d 14h)
Tokens: input ↓ 901k · output ↑ 63k · Cache: read 19.7m · hit 99.3%   Cost: $0.123 · Input $0.012 · Output $0.083 · Cache In $0.025 · Cache Write $0.003
```

适合：希望保持稳定的左右结构，同时看到更多绝对值和状态细节。

---

## 3.4 Custom

效果：使用你自己调整过的行、位置、Segment 和详细程度。

例如只保留项目、Git、Context 和 Cost：

```text
Project: project · Git: main · dirty · Context: 64.4%                 Cost: $0.123 · cache $0.028 · no-cache $0.095
```

Custom 不是一种固定样式，而是“我从某个 preset 出发，自己改了布局”。

---

# 4. Enable Footer：总开关

## 开启

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
Usage: Codex 58% (5hr) · 9% (7d)             Context: 64.4% · limit 272k
Tokens: input ↓ 901k · output ↑ 63k · Cache: read 19.7m · write 0 · hit 99.3%   Cost: $0.123 · cache $0.028 · no-cache $0.095
```

## 关闭

```text
（pi-x-footer 不再渲染自己的 Footer）
```

不会改变其他任何设置。重新开启后，原来的 Mode 和外观设置都还在。

---

# 5. Appearance：外观

## 5.1 Label style

Label style 控制每个信息项显示多少文字细节。

### Automatic

跟随当前 Mode：

| Mode | 实际效果 |
|---|---|
| Compact | 接近 Brief |
| Balanced | 接近 Labeled |
| Detailed | 接近 Detailed |
| Custom | 默认接近 Labeled |

---

### Brief

效果：保留标签，但缩短数值。

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
Usage: Codex 58% (5hr) · 9% (7d)             Context: 64.4%
Tokens: ↓901k ↑63k · Cache: 19.7mr 0w 99.3% hit    Cost: $0.123 · cache $0.028 · no-cache $0.095
```

和 Labeled 相比：

```text
Brief:   Tokens: ↓901k ↑63k
Labeled: Tokens: input ↓ 901k · output ↑ 63k
```

---

### Labeled

效果：正常标签 + 正常说明。

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
Usage: Codex 58% (5hr) · 9% (7d)             Context: 64.4% · limit 272k
Tokens: input ↓ 901k · output ↑ 63k · Cache: read 19.7m · write 0 · hit 99.3%   Cost: $0.123 · cache $0.028 · no-cache $0.095
```

---

### Detailed

效果：显示更多绝对值和次要状态。

```text
Project: project · Git: main · dirty (2)      openai-codex: gpt-5.6-luna (xhigh)
Usage: Codex 58% (5hr) · 9% (7d)             Context: 175k/272k · 64.4%
Tokens: input ↓ 901k · output ↑ 63k · Cache: read 19.7m · write 0 · hit 99.3%   Cost: $0.123 · cache $0.028 · no-cache $0.095
```

和 Labeled 相比：

```text
Labeled:  Git: main · dirty
Detailed: Git: main · dirty (2)

Labeled:  Context: 64.4% · limit 272k
Detailed: Context: 175k/272k · 64.4%
```

---

## 5.2 Color

### Semantic

用颜色表达状态。

```text
Git: main · dirty              [yellow]
Context: 64.4%                 [green]
Context: 82.0%                 [yellow]
Context: 95.0%                 [red]
Usage: Codex 91% (5hr)         [red]
```

适合：大多数用户。颜色是信息的一部分。

---

### Monochrome

不使用颜色，用文本符号表达状态。

```text
Git: main · dirty !
Context: 82.0% !
Context: 95.0% !!
Usage: Codex ? (5hr)
```

符号含义：

| 符号 | 状态 |
|---|---|
| `!` | 警告 |
| `!!` | 错误 |
| `?` | 信息不可用或加载中 |

适合：颜色主题不稳定、终端不支持颜色，或者不希望 Footer 有颜色。

---

## 5.3 Icons

### Off

```text
Git: main · dirty · Context: 64.4%
```

### Minimal

```text
git Git: main · dirty · ctx Context: 64.4%
```

### Nerd

```text
⑂ Git: main · dirty · ◒ Context: 64.4%
```

### Emoji

```text
🌿 Git: main · dirty · 🧠 Context: 64.4%
```

### 当前重要限制

当前实现里，Icons 只在较短的信息格式中显示。

也就是说，在默认 Balanced 模式下开启 Icons，通常看不到任何变化：

```text
# Icons: off
Project: project · Git: main · dirty

# Icons: nerd（当前 Balanced 下仍可能是这样）
Project: project · Git: main · dirty
```

在 Compact 模式下效果比较明显：

```text
⑂ Git: main · dirty                                        ◆ Model: gpt-5.6-luna
                                                     ◒ Context: 64.4%
```

这是一个已记录的易误解点。

---

## 5.4 Separator

Separator 改变同一行多个信息项之间的连接符。

### None

```text
Project: project Git: main · dirty Context: 64.4%
```

### Dot

```text
Project: project · Git: main · dirty · Context: 64.4%
```

### Bar

```text
Project: project | Git: main · dirty | Context: 64.4%
```

### Slash

```text
Project: project / Git: main · dirty / Context: 64.4%
```

### ASCII

当前效果和 Bar 一样：

```text
Project: project | Git: main · dirty | Context: 64.4%
```

### Powerline

当前效果也和 Bar 一样：

```text
Project: project | Git: main · dirty | Context: 64.4%
```

也就是说，目前 `Bar`、`ASCII`、`Powerline` 三个选项在视觉上没有区别。

---

## 5.5 Density

当前没有任何效果。

### Compact

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
```

### Cozy

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
```

两种设置的渲染结果当前完全相同。

---

# 6. Layout：布局

Layout 只在 Custom 模式中可编辑。

## 6.1 Identity：身份信息显示方式

### Collapsed（默认）

Provider、Model、Thinking 合并成一段：

```text
openai-codex: gpt-5.6-luna (xhigh)
```

效果：

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
```

优点：短、直观、占用宽度少。

---

### Separate

Provider、Model、Thinking 分成三个信息项：

```text
Provider: openai-codex · Model: gpt-5.6-luna · Thinking: xhigh
```

效果：

```text
Project: project · Git: main · dirty  Provider: openai-codex · Model: gpt-5.6-luna · Thinking: xhigh
```

优点：每一项都可以单独显示、隐藏或改 Label。

---

## 6.2 Left / Right：左右位置

同一个信息放在左边：

```text
Cost: $0.123 · Context: 64.4%
```

放在右边：

```text
Context: 64.4%                                                    Cost: $0.123
```

左右同时存在时，中间会自动填充空格：

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
```

---

## 6.3 Row visibility：某一行什么时候显示

### Always

只要这一行有内容，就一直显示。

```text
Project: project · Git: main · dirty
```

### When available / When non-empty

只有对应信息存在时才显示。

例如没有 Provider Usage 数据时：

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
Context: 64.4% · limit 272k
```

有 Provider Usage 数据时：

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
Context: 64.4% · limit 272k
Usage: Codex 58% (5hr)
```

### When streaming

只在 Agent 正在输出时显示。

适合放当前工具：

```text
Tool: Read
```

### When provider supported

只在当前 Provider 支持 Usage 查询时显示。

### When state is warning

只在某个信息进入 warning 状态时显示。

例如 Context 超过 warning threshold：

```text
Context: 82.0% [yellow]
```

当前限制：这个条件只匹配 warning，不匹配 error-only 状态。

---

## 6.4 Overflow：一行太宽时怎么办

假设原始内容是：

```text
Project: very-long-project-name · Git: main · dirty · Model: gpt-5.6-luna
```

### Hide

优先隐藏不重要信息：

```text
Git: main · dirty · Model: gpt-5.6-luna
```

### Compact

先把内容改短：

```text
very-long-project · main · dirty · gpt-5.6-luna
```

### Truncate

优先截断内容：

```text
Project: very-long-pro… · Git: main · dirty · Model: gpt-5.6…
```

---

# 7. Segments：显示哪些信息

每个 Segment 都可以独立开启或关闭。

## 7.1 所有信息项的效果

| Segment | 显示效果 |
|---|---|
| Identity | `openai-codex: gpt-5.6-luna (xhigh)` |
| Provider | `Provider: openai-codex` |
| Model | `Model: gpt-5.6-luna` |
| Thinking | `Thinking: xhigh` |
| Project | `Project: project` |
| Git | `Git: main · dirty` |
| Context | `Context: 64.4% · limit 272k` |
| Tokens | `Tokens: input ↓ 901k · output ↑ 63k` |
| Cache | `Cache: read 19.7m · write 0 · hit 99.3%` |
| Cost | `Cost: $0.123 · cache $0.028 · no-cache $0.095` |
| Tool | `Tool: Read` |
| Provider Usage | `Usage: Codex 58% (5hr)` |
| Extensions | `Extensions: lint: ready` |

---

## 7.1.1 Display 预设总览

每个核心信息块都有固定 Display 预设（Custom 模式下选择）：

```text
Project:      name (folder name)  -> Project: project
              path (full path)    -> Project: /Users/jin/dev/project

Git:          status -> Git: main · dirty
              branch -> Git: main
              full   -> Git: main ↑2↓3 · diff -5+6 (11) · files +3 -2 ~10 ?20

Cost:         compact  -> Cost: $0.123
              standard -> Cost: $0.123 · cache $0.028 · no-cache $0.095
              full     -> Cost: $0.123 · in $0.012 · out $0.083 · read $0.025 · write $0.003

Cost notation: arrows -> ↓ / ↑ / ← / →
               short  -> in / out / read / write
               full   -> Input / Output / Cache In / Cache Write

Tokens:       compact  -> Tokens: 964k       （Input + Output）
              standard -> Tokens: ↓901k ↑63k （Input / Output）
              full     -> Tokens: input ↓901k · output ↑63k

Usage:        compact  -> Usage: 58% · 9%
              standard -> Usage: Codex 58% (5hr) · 9% (7d)
              detailed -> Usage: Codex 58% (5hr resets in 3hr53m) · 9% (7d)

Windows:       5h / Week / Month independently Visible or Hidden
Resets:        On -> append reset countdowns; Off -> omit reset countdowns
```

Context / Tokens / Cache 的预设见各自章节。

Git `full` 中 `files` 的符号含义：`+` 新增文件（success 色）、`-` 删除文件（error 色）、`~` 修改文件（warning 色）、`?` 未跟踪文件（muted 色）；`↑↓` 为领先/落后上游的提交数。

## 7.2 Enabled：显示或隐藏

例如隐藏 Cache。

### 开启 Cache

```text
Tokens: input ↓ 901k · output ↑ 63k · Cache: read 19.7m · hit 99.3%
```

在当前会话还没有产生 usage 记录时，启用的 Token/Cache 仍保留这一行，并显示弱化的零值：

```text
Tokens: ↓0 ↑0 · Cache: read 0 · write 0
```

### 关闭 Cache

```text
Tokens: input ↓ 901k · output ↑ 63k
```

---

## 7.3 Identity 的特殊规则

Identity 是 Provider、Model、Thinking 的组合。

默认：

```text
openai-codex: gpt-5.6-luna (xhigh)
```

如果隐藏 Thinking：

```text
openai-codex: gpt-5.6-luna
```

如果隐藏 Provider：

```text
gpt-5.6-luna (xhigh)
```

如果隐藏 Model，但保留 Provider：

```text
openai-codex (xhigh)
```

---

## 7.4 Label：修改信息项名字

例如把 `Context` 改成 `Window`。

### 修改前

```text
Context: 64.4% · limit 272k
```

### 修改后

```text
Window: 64.4% · limit 272k
```

例如把 `Git` 改成 `Branch`：

```text
Branch: main · dirty
```

---

# 8. Context：上下文显示

Context 使用三个固定的显示预设，按信息量从少到多排列：

## 8.1 Display: Compact

```text
Context: 25.5%
```

只显示使用比例，适合窄屏和低干扰布局。

## 8.2 Display: Hybrid

```text
Context: 1.0m × 25.5%
```

显示 Context Limit 和使用比例，不直接显示计算后的已用 Token。

## 8.3 Display: Full（默认）

```text
Context: 261k/1.0m (25.5%)
```

同时显示已用 Token、Limit 和使用比例。

---

# 9. Provider Usage：账号额度

## 9.1 Enabled

### 开启

```text
Usage: Codex 58% (5hr) · 9% (7d)
```

### 关闭

```text
（不显示 Usage 行，也不请求 Provider Usage）
```

---

## 9.2 Provider 颜色

### Codex

```text
Usage: Codex 58% (5hr)
```

### OpenCode Go

```text
Usage: OpenCode Go 21% (5hr)
```

`Codex` / `OpenCode Go` 使用 Provider accent 颜色，百分比使用独立的额度状态颜色。只有当前模型对应的 Provider 会真正显示。

---

## 9.3 Windows

用户可以独立选择显示哪些窗口：

```text
5h          On / Off
Week (7d)   On / Off
Month (30d) On / Off
```

默认显示 `5h` 和 `Week (7d)`，Month 默认关闭。只渲染选中的、且 Provider 实际返回的窗口；至少保留一个窗口。Provider 的 `rolling` / `weekly` / `monthly` 别名分别归一化为 5h / Week / Month。

---

## 9.4 Display

Display 只控制信息密度，不控制窗口数量或 reset 是否显示：

```text
compact   Usage: 58% · 9%
standard  Usage: Codex 58% (5hr) · 9% (7d)
detailed  Usage: Codex 58% (5hr resets in 3hr53m) · 9% (7d)
```

---

## 9.5 Reset time

Reset 是独立的 On / Off 设置：

```text
Resets Off
Usage: Codex 58% (5hr) · 9% (7d)

Resets On + Detailed
Usage: Codex 58% (5hr resets in 3hr53m) · 9% (7d)
```

Compact 使用简短倒计时，Standard 使用短 `reset` 后缀，Detailed 使用完整的 `resets in` 表达。如果 Provider 没有返回 reset 时间，该窗口不显示 reset 部分。

---

## 9.6 Refresh interval

这个设置不直接改变文本样式，只改变数据更新频率，默认值为 30 秒。

```text
每 30 秒：默认值，及时但仍有节制
每 1 分钟：请求更少
每 5 分钟：请求更少，但额度可能更旧
```

如果数据过期，Usage 可能进入 stale 状态：

```text
Usage: Codex 58% (5hr) · 9% (7d) [yellow]
```

---

# 10. Thresholds：什么时候变黄、变红

## 10.1 Context warning / error

默认效果：

| Context 使用率 | 效果 |
|---|---|
| 低于 70% | 绿色 |
| 70% – 89% | 黄色 |
| 90% 及以上 | 红色 |

示例：

```text
Context: 64.4% [green]
Context: 75.0% [yellow]
Context: 95.0% [red]
```

如果把 warning 从 70 改成 50：

```text
Context: 64.4% [yellow]
```

如果把 error 从 90 改成 80：

```text
Context: 82.0% [red]
```

---

## 10.2 Provider Usage warning / error

默认效果：

```text
Usage: Codex 58% (5hr) [green]
Usage: Codex 75% (5hr) [yellow]
Usage: Codex 91% (5hr) [red]
```

在 Monochrome 模式下：

```text
Usage: Codex 75% (5hr) !
Usage: Codex 91% (5hr) !!
```

---

# 11. Responsive：终端变窄时怎么显示

## 11.1 默认宽度 120

```text
Project: project · Git: main · dirty                                                  openai-codex: gpt-5.6-luna (xhigh)
Usage: Codex 58% (5hr) · 9% (7d)                                                  Context: 64.4% · limit 272k
Tokens: input ↓ 901k · output ↑ 63k · Cache: read 19.7m · write 0 · hit 99.3%                                  Cost: $0.123 · cache $0.028 · no-cache $0.095
```

## 11.2 宽度 80

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
Usage: Codex 58% (5hr) · 9% (7d)             Context: 64.4% · limit 272k
Cache: read 19.7m · write 0 · hit 99.3%      Cost: $0.123
```

Tokens 被隐藏（优先级低于 Cache），Context 和 Cost 保持在右侧。

## 11.3 宽度 60

```text
Project: project          openai-codex: gpt-5.6-luna (xhigh)
Usage: Codex 58% (5hr) · 9% (7d)  Context: 64.4% · limit 272k
Cache: read 19.7m · write 0 · hit 99.3%       Cost: $0.123
```

Project 的优先级高于 Git（85 vs 70），所以窄宽度时 Git 先被隐藏，Project 和 Identity 保留。

## 11.4 宽度 40

```text
      openai-codex: gpt-5.6-luna (xhigh)
             Context: 64.4% · limit 272k
                            Cost: $0.123
```

Project、Git、Usage、Tokens、Cache 被隐藏，优先保留 Identity、Context 和 Cost。

---

## 11.5 Strategy：Hide → Compact → Truncate

先隐藏次要信息，再压缩，再截断。

```text
# 宽
Project: project · Git: main · dirty · Context: 64.4%

# 窄
Git: main · dirty · Context: 64.4%
```

适合：优先保证信息可读。

---

## 11.6 Strategy：Compact → Hide → Truncate

先压缩信息，再隐藏。

```text
# 宽
Project: project · Git: main · dirty · Context: 64.4%

# 窄
project · main · dirty · 64.4%
```

适合：尽量保留更多类型的信息。

---

## 11.7 Strategy：Truncate

先截断，再隐藏。

```text
# 宽
Project: project · Git: main · dirty · Context: 64.4%

# 窄
Project: pro… · Git: ma… · Context: 64…
```

适合：希望每个信息项都尽量留在屏幕上。

---

# 12. Project Overrides

这个设置不会改变当前 Footer 的文本样式，只改变设置作用范围。

## 关闭

所有项目使用同一套 Footer 设置。

## 开启

当前项目可以使用自己的 Footer 设置。

例如：

```text
全局：Balanced + 无图标
当前项目：Compact + Nerd icons
```

进入这个项目时显示：

```text
⑂ Git: main · dirty                                        ◆ Model: gpt-5.6-luna
                                                     ◒ Context: 64.4%
```

进入其他项目时显示：

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
                                               Context: 64.4% · limit 272k
```

---

# 13. 当前没有效果或容易误解的设置

这些是当前实现中的真实行为，不是用户理解错误。

| 设置 | 当前行为 |
|---|---|
| Density | 没有任何渲染效果 |
| Icons（默认 Balanced） | 通常看不到图标 |
| Separator: ASCII | 和 Bar 一样 |
| Separator: Powerline | 和 Bar 一样，没有 Powerline glyph |
| Label style: Brief | 仍显示 Label，只是数值更短 |
| Row visibility: warning | 只匹配 warning，不匹配 error-only |
| Refresh interval | 只影响数据新鲜度，不直接改变文本样式 |

---

# 14. 推荐怎么选

## 想要最少信息

```text
Mode: Compact
Label style: Automatic
Icons: Off
Separator: Dot
```

效果：

```text
Git: main · dirty                                            Model: gpt-5.6-luna
Context: 64.4%
```

## 想要默认推荐

```text
Mode: Balanced
Label style: Automatic
Color: Semantic
Icons: Off
Separator: Dot
```

效果：

```text
Project: project · Git: main · dirty          openai-codex: gpt-5.6-luna (xhigh)
Context: 64.4% · limit 272k · Tokens: input ↓ 901k · output ↑ 63k   Cost: $0.123 · cache $0.028 · no-cache $0.095
Usage: Codex 58% (5hr) · 9% (7d)
```

## 想要更多信息

```text
Mode: Detailed
Color: Semantic
Usage Display: Detailed
Resets: On
```

效果：

```text
Project: project · Git: main · dirty (2)      openai-codex: gpt-5.6-luna (xhigh)
Usage: Codex 58% (5hr resets in 3hr53m) · 9% (7d resets in 6d 14h)  Context: 175k/272k · 64.4%
Tokens: input ↓ 901k · output ↑ 63k · Cache: read 19.7m · write 0 · hit 99.3%   Cost: $0.123 · Input $0.012 · Output $0.083 · Cache In $0.025 · Cache Write $0.003
```

## 想要无颜色

```text
Color: Monochrome
```

效果：

```text
Git: main · dirty !
Context: 95.0% !!
Usage: Codex 91% (5hr) !!
```

## 想要图标

当前建议使用 Compact 或较短的 Label style，否则可能看不到图标：

```text
Mode: Compact
Icons: Nerd
```

效果：

```text
⑂ Git: main · dirty                                        ◆ Model: gpt-5.6-luna
                                                     ◒ Context: 64.4%
```
