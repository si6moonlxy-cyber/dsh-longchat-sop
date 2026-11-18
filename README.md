# dsh-longchat-sop

**DSH 长会话「保真压缩」标准流程**：把几百轮的长对话（学习、工作、心理咨询…）从旧环境迁移/归档，并压缩成可继续使用的工作副本。

> 核心原则：**保真靠归档，压缩只做工作副本**。任何模型摘要都有损；原始会话必须无损保存。

## 它能解决什么

- 从 DeepSeek 网页/App 导入 DSH 的几百个长会话，如何分级处理；
- 从旧 DSH 迁移到新 DSH（或 DSH Go）时，如何不丢上下文；
- 心理咨询类会话为什么**不能**用通用 `/compact`，以及应该怎么做；
- 批量处理几百个会话时的顺序、成本与验收标准。

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
```

## 快速开始

```powershell
# 1) 定位会话文件
$s = "$env:APPDATA\dsh-desktop\harness\sessions\<workspace-key>\<session-id>\session.v4.jsonl.zstd"

# 2) 解压成 JSONL（支持多帧 zstd）
node tools/decompress-session.cjs $s out.jsonl

# 3) 分析结构 / 尺寸
node tools/analyze-session.cjs out.jsonl

# 4) 导出可读 Markdown（去掉运行时与记忆注入块）
node tools/export-markdown.cjs out.jsonl transcript.md

# 5) 压缩后验收
node tools/check-compact.cjs after.jsonl before.jsonl digest.md
```

## 领域策略（先分类，再动手）

| 领域 | 能否用 `/compact` | 正确交付 |
|---|---|---|
| 学习 / 资料 | 可以，甚至推荐 | 主题索引 + 中文要点 + 原文归档 |
| 心理咨询 | **不可以** | 原文归档（不压）+ 中文临床笔记（含风险栏）+ 新会话种子 |
| 代码 / 项目 | 可以，但保留路径与错误原文 | 技术摘要 + 文件路径 + 原文归档 |

咨询类为什么不行：通用压缩会把对话压成英文工程摘要，丢掉原话、语气与风险信息，并改变治疗关系。详见 `docs/SOP.md`。

## 实测证据

`杂论`（Agent 工作区，515,662 tokens）：

- `/compact` 一次压掉 1,615 条 / 515,040 tokens，表面从 515,662 → **2,308 tokens**（99.55%）；
- 摘要 6,334 字符、8/8 段齐全，但**是英文**；
- 12 个关键词抽查：保留 6、丢失 6（斩杀线、五险一金、华戎、以撒、同轴座、表格）。

结论：`/compact` 只能当 **L1 索引**，不能当“保真压缩”产品。

## 许可

MIT
