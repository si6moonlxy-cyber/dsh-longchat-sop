# compaction-zh（DSH 中文压缩引擎补丁）

把 DSH 压缩引擎默认的英文 8 段指令，替换成**中文、分领域、保真**的 checkpoint 指令。

## 原理

DSH 的 `@deepseek-ai/dsh-compaction-basic` 在压缩时通过 `ctx.llm.stream({ purpose: 'compaction' })` 发送一次辅助请求，最后一条 user 消息就是固定英文指令。
本插件包装 `llm.stream`：检测到 `purpose === 'compaction'` 时，把最后一条 user 指令替换成中文模板。压缩的选取、保留尾巴、落盘逻辑全部不变。

- 不改安装包、不重编译；
- 自动压缩与 `/compact` 都会生效；
- 输出仍是同一条 `compaction/summary` 事件，会话继续沿用原 session-id。

## 安装

1. 把 `compaction-zh.mjs` 复制到你的 profile 目录，例如
   `%APPDATA%\dsh-desktop\harness\profiles\desktop\compaction-zh.mjs`
2. 在该目录的 `cordis.patch.yml` 末尾追加：

   ```yaml
   - insert:
       - id: compaction-zh
         name: './compaction-zh.mjs'
   ```

3. 重启 DSH；日志出现 `compaction-zh: loaded` 即生效。
4. 验证：任意会话 `/compact`，summary 应为中文结构（实验性，先在副本上试）。

## 自定义提示词

补丁行可带 `config.prompt` 覆盖默认中文模板：

```yaml
- insert:
    - id: compaction-zh
      name: './compaction-zh.mjs'
      config:
        prompt: |
          你的中文压缩指令……
```

## 限制

- 依赖 `llm.stream` 的调用形态（`purpose: 'compaction'`、最后一条 user 指令）；DSH 升级后需回归验证。
- 只替换指令文本，不改 `frameSummary` 的英文 preamble（那段不影响摘要内容）。
