# session-import（DSH / DSH Go 会话导入 bundle）

把 `.zip` 会话包导入当前 DSH（含 **DSH Go 本地模式**）：写入 `<DSH_HOME>/sessions/`，登记 `storages/workspace.json`，返回导入清单。

## zip 结构

```
manifest.json
sessions/<workspace-key>/<session-id>/session.v3.jsonl.zstd
sessions/<workspace-key>/<session-id>/session.v4.jsonl.zstd
```

`manifest.json`：

```json
{
  "version": 1,
  "workspaces": [
    { "key": "--D-Project_Mine-Agent--", "path": "D:\\Project_Mine\\Agent", "title": "Agent", "sessions": ["72c42e73-..."] }
  ]
}
```

生成方式（桌面端）：

```powershell
node tools/pack-sessions.cjs D:\out\agent.zip D:\Project_Mine\Agent
```

## 安装

把本目录（`package.json` + `cordis.patch.yml` + `import-sessions.mjs`）作为 DSH bundle 安装到目标环境：

- DSH Go：`Settings › Plugins › Plugin market`，从 GitHub 源安装本仓库的 `bundles/session-import`，或使用其命令行等价方式；
- 桌面 DSH：把目录放进 profile 并用 `dsh plugin add` / 手动 patch 引用。

安装后重启引擎。工具页/模型工具里会出现 **`import_sessions`**。

## 使用

让 agent 调用：

```
import_sessions({
  zipPath: "/sdcard/Download/agent.zip",
  workspacePath: "/data/user/0/<pkg>/files/dsh/workspaces/agent",  // 省略则用 manifest 或 <home>/imported/<zip名>
  title: "Agent",
  dryRun: true
})
```

- `dryRun: true` 只预演（返回将导入/跳过的 session 列表）；
- `overwrite: true` 覆盖同 id 会话（默认跳过）；
- 成功后需要**重启 DSH / 刷新界面**，新工作区与会话才会出现在侧栏。

## 说明

- 只依赖 `node:` 内置模块（fs/path/zlib/crypto），不引入第三方依赖；
- 只搬运会话文件与工作区登记，不改会话内容；`session.v3` / `session.v4` 原样保留；
- 目标 DSH 版本需能读对应会话格式（0.2.x 读 v4；旧版只读 v3）；
- 手机端路径以 DSH Go 的 app 私有目录为准；`/sdcard` 路径需要 app 的“访问手机文件”权限。
