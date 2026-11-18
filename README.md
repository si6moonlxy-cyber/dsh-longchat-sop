# dsh-longchat-sop

![DeepSeek 限额后把聊天记录搬回本地](docs/pic.png)

**DSH 长会话「保真压缩」标准流程**：把几百轮的长对话（学习、工作、心理咨询…）从旧环境迁移/归档，并压缩成可继续使用的工作副本。

> 核心原则：**保真靠归档，压缩只做工作副本**。任何模型摘要都有损；原始会话必须无损保存。

## 它能解决什么

- 从 DeepSeek 网页/App 导入 DSH 的几百个长会话，如何分级处理；
- 从旧 DSH 迁移到新 DSH（或 DSH Go）时，如何不丢上下文；
- 心理咨询类会话为什么**不能**用通用 `/compact`，以及应该怎么做；
- 批量处理几百个会话时的顺序、成本与验收标准。

## 标准流程（服务交付）

1. **下载**：从 DeepSeek 网页/App 导出会话（官方 DSH 的 `dsh-deepseek-chat-import` bundle 负责导入）。
2. **移植**：导入官方 DSH 对应工作区，保留标题与时间线。
3. **归档**：无用会话只做无损归档（原始 session + 可选 Markdown），不压缩。
4. **压缩**：有用会话在**原会话内**原地压缩（`/compact` 或自定义 compaction engine），**不新开会话**。
5. **交付**：客户拿到的是同名、同工作区、能接着聊的会话 + 一份归档包。

> 原则：**交付的是“原对话”，不是“新对话”**。新会话/seed 只用于跨设备迁移或原会话损坏的兜底。

## 目录

```
docs/SOP.md              完整标准流程（含领域判定、验收、批量策略）
docs/trial-2026-11-18.md 一次真实试压记录（杂论 515k→2.3k）与结论
templates/clinical-note.md  心理咨询类：中文临床笔记模板
templates/digest.md         学习/资料类：主题摘要模板
tools/decompress-session.cjs  DSH 多帧 zstd 会话 → JSONL
tools/export-markdown.cjs     JSONL → 可读 Markdown（自动去运行时/记忆注入噪声）
tools/analyze-session.cjs     消息尺寸分布（判断压缩可行性）
tools/check-compact.cjs       压缩质量检查（摘要长度/结构/关键词覆盖）
tools/show-compaction.cjs     查看会话里的 compaction 事件与摘要
tools/inventory-sessions.cjs  盘点全部会话（工作区/标题/tokens）→ CSV（Windows Desktop）
```

## 快速开始

> 需要 Node 22.15+ / 24（脚本用内置 `zlib.zstdDecompressSync`，无需安装依赖）。
> `inventory-sessions.cjs` 读的是 Windows Desktop 的 `%APPDATA%\dsh-desktop\harness`，其他平台需改路径。

```powershell
# 1) 定位会话文件
$s = "$env:APPDATA\dsh-desktop\harness\sessions\<workspace-key>\<session-id>\session.v4.jsonl.zstd"

# 2) 解压成 JSONL（支持多帧 zstd）
node tools/decompress-session.cjs $s out.jsonl

# 3) 分析结构 / 尺寸
node tools/analyze-session.cjs out.jsonl

# 4) 导出可读 Markdown（去掉运行时与记忆注入块）
node tools/export-markdown.cjs out.jsonl transcript.md   # 第 4 个参数可指定助手显示名，默认「助手」

# 5) 压缩后验收
node tools/check-compact.cjs after.jsonl before.jsonl digest.md
```

## 领域策略（先分类，再动手）

| 领域 | 能否用 `/compact` | 正确交付 |
|---|---|---|
| 学习 / 资料 | **可以，推荐直接压**（不需要超长上下文的场景） | 主题索引 + 中文要点 +（可选）原文归档 |
| 心理咨询 | **不可以** | 原文归档（不压）+ 中文临床笔记（含风险栏）+ 新会话种子 |
| 角色扮演 / 情感陪伴 / 对话模拟 | **不可以** | 人设卡 + 关系线 + 关键台词/梗库 + 雷区（`templates/roleplay-note.md`）+ 原文归档 |
| 代码 / 项目 | 可以，但保留路径与错误原文 | 技术摘要 + 文件路径 + 原文归档 |

咨询类为什么不行：通用压缩会把对话压成英文工程摘要，丢掉原话、语气与风险信息，并改变治疗关系。详见 `docs/SOP.md`。

## B：中文压缩引擎（可选增强）

`bundles/compaction-zh/` 把 DSH 默认的英文压缩指令替换成**中文、分领域、保真**模板；自动压缩与 `/compact` 都生效，会话仍是原 session-id。安装见该目录 `README.md`。

## 工具链（三件套）

| 工具 | 位置 | 作用 |
|---|---|---|
| 中文压缩引擎 | `bundles/compaction-zh/` | 把 DSH 默认英文压缩指令换成中文、分领域模板；自动压缩与 `/compact` 都生效，原 session-id 不变 |
| 会话导入器 | `bundles/session-import/` | 把会话 zip 导入 DSH / DSH Go：写 sessions + 登记 workspace.json |
| 打包器 | `tools/pack-sessions.cjs` | 桌面端把某工作区会话打成 zip（manifest + session 文件） |
| 分析工具 | `tools/*.cjs` | 解压、导出 Markdown、尺寸分析、压缩质量检查、盘点 |

## 常见坑（实测）

1. **自动压缩会抢跑**：DSH 默认 `auto: true`，在请求前按压力自动压缩；写“先笔记再压缩”会被它插队。对策：用 `compaction-zh` 让自动压缩本身产出中文保真摘要，不要试图靠顶层 patch 关它（`compaction-basic` 是嵌套行，顶层 patch 往往打不到）。
2. **改 `contextWindow` 不改变压缩阈值**：阈值按适配器容量/压力算，调大声明值无效（实测 1M→2M 仍触发）。
3. **工作区目录键有转义规则**：`D:\Project_Mine\Agent` → `--D-Project_Mine-Agent--`（盘符后的 `:\` 合并成一个 `-`），空格 → `~0020`（如 `Obsidian~0020Vault`）。打包/导入必须用同一规则，否则会话“导入了但看不见”。
4. **v3/v4 格式**：0.2.x 写 v4；旧内核只读 v3。跨版本导入前先确认目标内核能读。
5. **`/compact` 只压“保留尾巴之前”的一段**：默认保留约 16% 窗口；尾巴内有超大消息时一次能压的很少。
6. **会话 zip 不要包含本地备份**：只收 `session.v*.jsonl.zstd`，否则体积翻倍、导入脏文件。

## DSH Go 交付

- **Remote 模式（存量会话推荐）**：DSH Go 连电脑，压缩在电脑侧完成，手机只看结果；
- **Local 模式**：装 `compaction-zh` + `session-import`，用 `pack-sessions` 打包 → 传手机 → `import_sessions` 导入 → 重启刷新；
- 导入后会话头里的 `cwd` 仍是电脑路径（只影响工具工作目录，显示不受影响）。

## 实测证据

`杂论`（Agent 工作区，515,662 tokens）：

- `/compact` 一次压掉 1,615 条 / 515,040 tokens，表面从 515,662 → **2,308 tokens**（99.55%）；
- 摘要 6,334 字符、8/8 段齐全，但**是英文**；
- 12 个关键词抽查：保留 6、丢失 6（斩杀线、五险一金、华戎、以撒、同轴座、表格）。

结论：`/compact` 只能当 **L1 索引**，不能当“保真压缩”产品。

## 许可

MIT
