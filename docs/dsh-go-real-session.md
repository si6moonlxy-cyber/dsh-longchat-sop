# DSH Go 真会话导入（实测记录 2026-11-19）

> 目标：把桌面 DSH 的会话变成 DSH Go 里**可继续聊**的会话（不是 Markdown 只读版）。
> 结论：可行。核心是 `dsh-session-port` 插件 + 一个「指定目标工作区」的小工具。

## 一、原生包格式（已实测）

DSH 原生导出：

```
dsh-session-<session-id>.zip
└── session.v4.jsonl          # 纯文本 JSONL，不是 zstd
```

- 桌面端导出：Session 头部「Download session log」或输入 `/export`；
- 导出的 zip 里附件走 `media/<attachmentId>.<ext>`、`files/<digest>/...`；
- 手工拼的包只放 `session.v4.jsonl` 也能被导入（实测成功），但**没有附件**，图片会缺。

## 二、手机端安装导入插件

手机连不上 GitHub 时，用 npm 镜像：

```bash
dsh plugin --profile web add dsh-session-port
```

安装后插件注册 `session_port` 工具：

```
session_port({ action: "import", path: "/sdcard/DeepSeekGO/dsh-session-<id>.zip" })
```

**限制**：它会把会话导入到**发起导入的那个对话所在的工作目录**（calling session 的 cwd）。所以在一个绑定 DeepSeekGO 的对话里，永远导不进「学习目录」。

## 三、指定目标工作区（本地 helper）

在 `profile web` 的 `cordis.patch.yml` 末尾加一个本地插件，复用 `dsh-session-port` 已测试的 `importSession()`，多收一个目标目录参数：

```js
// /root/.dsh/local-plugins/session-import-into/index.mjs
import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { importSession } from '/root/.dsh/profiles/web/node_modules/dsh-session-port/lib/host.js'

export const name = 'session-import-into'
export const inject = ['tools', 'sessionQuery', 'sessionPersistence']

export function apply(ctx) {
  const tools = ctx.get('tools')
  if (!tools || typeof tools.register !== 'function') return
  tools.register({
    name: 'import_session_into',
    description: '把 DSH 会话包导入到指定工作区目录（绝对路径）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        targetDirectory: { type: 'string' },
      },
      required: ['path', 'targetDirectory'],
      additionalProperties: false,
    },
    async execute(args) {
      const target = resolve(args.targetDirectory)
      if (!isAbsolute(args.targetDirectory) || (await stat(target).catch(() => null))?.isDirectory() !== true) {
        throw new Error('targetDirectory 必须是存在的绝对目录')
      }
      const result = await importSession(args.path, target)
      return `已导入 ${result.sessionId}（${result.eventCount} 条事件，${result.attachmentCount} 个附件）`
    },
  })
}
```

`cordis.patch.yml` 末尾：

```yaml
- insert:
    - id: session-import-into
      name: /root/.dsh/local-plugins/session-import-into/index.mjs
```

改完 HMR 会热加载（实测不用重启引擎）；未热加载时，在文件里追加一行注释触发重载。

## 四、验证

1. `workspace.json` 里目标工作区的 `sessionIds` 出现新会话；
2. 会话头 `cwd` 已被改写成目标目录；
3. App 会话列表下拉刷新，目标工作区出现该会话；
4. 事件数与源包一致（实测 3532 条，含最新一轮）。

## 五、坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 导入成功但落在别的工区 | `session_port` 固定用 calling session 的 cwd | 用 `import_session_into` 显式指定目录 |
| 导入后图片缺失 | 手拼包没带 `media/`、`files/` | 用桌面 `/export` 原生包，或接受无附件 |
| 改了 patch 不生效 | HMR 没触发 | 追加注释触发重载，或重启引擎 |
| 手机装不了插件 | GitHub 不可达 | 用 npmmirror 的 npm 包 |
| 出现重复会话 | 每次导入生成新 id | 导入确认后删旧副本 |
