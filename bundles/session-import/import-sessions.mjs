// session-import: 把 DSH 会话 zip 导入当前 DSH（含 DSH Go 本地模式）。
// zip 结构：manifest.json + sessions/<workspace-key>/<session-id>/session.v*.jsonl.zstd
// 只依赖 node: 内置模块，便于在 Android/DSH Go 的 Host 进程里运行。

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'
import crypto from 'node:crypto'

export const name = 'session-import'
export const inject = ['tools']

// ---------- ZIP 读取（store / deflate） ----------
function findEocd(buf) {
  const min = Math.max(0, buf.length - 65557)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i
  }
  return -1
}

export function readZip(buf) {
  const eocd = findEocd(buf)
  if (eocd < 0) throw new Error('not a zip: end of central directory not found')
  const count = buf.readUInt16LE(eocd + 10)
  const cdOffset = buf.readUInt32LE(eocd + 16)
  const files = new Map()
  let p = cdOffset
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory entry')
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    p += 46 + nameLen + extraLen + commentLen

    const lh = localOffset
    if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error('bad local file header: ' + name)
    const lNameLen = buf.readUInt16LE(lh + 26)
    const lExtraLen = buf.readUInt16LE(lh + 28)
    const dataOffset = lh + 30 + lNameLen + lExtraLen
    const data = buf.subarray(dataOffset, dataOffset + compSize)
    if (name.endsWith('/')) continue
    files.set(name, method === 0 ? Buffer.from(data) : method === 8 ? zlib.inflateRawSync(data) : (() => { throw new Error('unsupported zip method ' + method + ': ' + name) })())
  }
  return files
}

// ---------- 工作区工具 ----------
function workspaceKeyFor(workspacePath) {
  return '--' + workspacePath.replace(/[\\/:*?"<>|]/g, '-') + '--'
}

function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

function ensureWorkspace(workspaceJson, workspacePath, title, sessionIds) {
  const now = new Date().toISOString()
  const tables = workspaceJson.tables || (workspaceJson.tables = { workspaces: {} })
  const workspaces = tables.workspaces || (tables.workspaces = {})
  const global = workspaceJson.global || (workspaceJson.global = { initialized: true, workspaceIds: [], archivedSessionIds: [] })
  if (!Array.isArray(global.workspaceIds)) global.workspaceIds = []

  let id = Object.keys(workspaces).find((key) => String(workspaces[key].path).toLowerCase() === workspacePath.toLowerCase())
  if (!id) {
    id = crypto.randomUUID()
    workspaces[id] = { path: workspacePath, title: title || path.basename(workspacePath), sessionIds: [], createdAt: now, updatedAt: now }
    global.workspaceIds.push(id)
  }
  const entry = workspaces[id]
  if (!Array.isArray(entry.sessionIds)) entry.sessionIds = []
  for (const sid of sessionIds) if (!entry.sessionIds.includes(sid)) entry.sessionIds.push(sid)
  entry.updatedAt = now
  if (title) entry.title = title
  return id
}

/**
 * 导入一个会话 zip。
 * @param {{zipPath:string, home?:string, workspacePath?:string, title?:string, dryRun?:boolean, overwrite?:boolean}} options
 */
export async function importZip(options) {
  const zipPath = options.zipPath
  if (!zipPath || !fs.existsSync(zipPath)) throw new Error('zip not found: ' + zipPath)
  const home = options.home || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const buf = fs.readFileSync(zipPath)
  const files = readZip(buf)

  const manifest = files.has('manifest.json')
    ? JSON.parse(files.get('manifest.json').toString('utf8'))
    : null
  const manifestWorkspace = manifest && Array.isArray(manifest.workspaces) ? manifest.workspaces[0] : null

  const workspacePath = options.workspacePath
    || (manifestWorkspace && manifestWorkspace.path)
    || path.join(home, 'imported', path.basename(zipPath, path.extname(zipPath)))
  const title = options.title || (manifestWorkspace && manifestWorkspace.title) || path.basename(workspacePath)
  const key = workspaceKeyFor(workspacePath)

  // 收集 sessions/<key>/<sid>/<file>
  const sessions = new Map()
  for (const [name, data] of files) {
    const m = /^sessions\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(name)
    if (!m) continue
    const sid = m[2]
    if (!sessions.has(sid)) sessions.set(sid, [])
    sessions.get(sid).push({ file: m[3], data })
  }
  if (sessions.size === 0) throw new Error('zip has no sessions/<workspace>/<session-id>/session.v*.jsonl.zstd entries')

  const report = { home, workspacePath, workspaceKey: key, sessions: [], skipped: [], dryRun: Boolean(options.dryRun) }

  const targetRoot = path.join(home, 'sessions', key)
  for (const [sid, entries] of sessions) {
    const target = path.join(targetRoot, sid)
    if (fs.existsSync(target) && !options.overwrite) { report.skipped.push(sid); continue }
    if (!options.dryRun) {
      fs.mkdirSync(target, { recursive: true })
      for (const e of entries) fs.writeFileSync(path.join(target, e.file), e.data)
    }
    report.sessions.push(sid)
  }
  if (options.dryRun) return report

  fs.mkdirSync(workspacePath, { recursive: true })
  const wsFile = path.join(home, 'storages', 'workspace.json')
  fs.mkdirSync(path.dirname(wsFile), { recursive: true })
  const ws = readJsonSafe(wsFile, null) || { unit: { name: 'workspace', version: 2 }, global: { initialized: true, workspaceIds: [], archivedSessionIds: [] }, tables: { workspaces: {} } }
  const id = ensureWorkspace(ws, workspacePath, title, report.sessions)
  fs.writeFileSync(wsFile, JSON.stringify(ws, null, 2))
  report.workspaceId = id
  return report
}

// ---------- 工具注册 ----------
export function apply(ctx, config) {
  const tool = {
    name: 'import_sessions',
    description: '导入 DSH 会话 zip（manifest.json + sessions/<workspace>/<session-id>/session.v3|v4.jsonl.zstd）到当前 DSH 的 home，登记工作区并返回导入清单。dryRun 可先预演。',
    parameters: {
      zipPath: { type: 'string', required: true, description: 'zip 的绝对路径（手机上通常是 /sdcard/Download/xxx.zip）' },
      workspacePath: { type: 'string', description: '目标工作区目录；省略则用 manifest 或 <home>/imported/<zip名>' },
      title: { type: 'string', description: '工作区显示名' },
      dryRun: { type: 'boolean', description: '只检查不写入' },
      overwrite: { type: 'boolean', description: '覆盖已存在的同 id 会话' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true, properties: {} },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      return importZip({
        zipPath: args.zipPath,
        workspacePath: args.workspacePath,
        title: args.title,
        dryRun: args.dryRun === true,
        overwrite: args.overwrite === true,
      })
    },
  }
  if (ctx.tools && typeof ctx.tools.register === 'function') {
    ctx.tools.register(tool)
    ctx.logger?.info?.('session-import: tool import_sessions registered')
  } else {
    ctx.logger?.warn?.('session-import: tools service unavailable')
  }
}
