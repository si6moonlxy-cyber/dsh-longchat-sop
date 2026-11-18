// 把某个工作区的会话打包成可导入 zip：manifest.json + sessions/<key>/<sid>/session.v*.jsonl.zstd
// 用法：node pack-sessions.cjs <out.zip> <workspacePath> [sessionId1,sessionId2,...]
const fs = require('fs')
const path = require('path')

const HOME = process.env.DSH_HOME || path.join(process.env.APPDATA || '', 'dsh-desktop', 'harness')

// DSH 的会话目录键：盘符 "D:\" → "D-"，其余 \ 或 / → "-"，空格 → "~0020"
function workspaceKeyFor(workspacePath) {
  let s = workspacePath.replace(/^([A-Za-z]):[\\/]/, '$1-')
  s = s.replace(/[\\/]/g, '-').replace(/ /g, '~0020').replace(/[<>:"|?*]/g, '-')
  return '--' + s + '--'
}

// ---------- CRC32 ----------
const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ---------- ZIP（store） ----------
function writeZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8')
    const crc = crc32(e.data)
    const size = e.data.length
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(size, 18)
    local.writeUInt32LE(size, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    locals.push(local, nameBuf, e.data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(size, 20)
    central.writeUInt32LE(size, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuf)

    offset += 30 + nameBuf.length + size
  }
  const centralSize = centrals.reduce((s, b) => s + b.length, 0)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(centralSize, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, ...centrals, eocd])
}

// ---------- main ----------
const [outZip, workspacePath, sessionFilter] = process.argv.slice(2)
if (!outZip || !workspacePath) {
  console.error('usage: node pack-sessions.cjs <out.zip> <workspacePath> [sessionId1,sessionId2,...]')
  process.exit(1)
}
const wsFile = path.join(HOME, 'storages', 'workspace.json')
const ws = JSON.parse(fs.readFileSync(wsFile, 'utf8'))
const entry = Object.values(ws.tables.workspaces).find((w) => String(w.path).toLowerCase() === workspacePath.toLowerCase())
if (!entry) { console.error('workspace not found in workspace.json: ' + workspacePath); process.exit(1) }

const key = workspaceKeyFor(workspacePath)
const dir = path.join(HOME, 'sessions', key)
const wanted = sessionFilter ? sessionFilter.split(',') : entry.sessionIds
const entries = []
const sessions = []
for (const sid of wanted) {
  const sdir = path.join(dir, sid)
  if (!fs.existsSync(sdir)) { console.warn('skip missing session: ' + sid); continue }
  sessions.push(sid)
  for (const f of fs.readdirSync(sdir)) {
    const fp = path.join(sdir, f)
    if (!fs.statSync(fp).isFile()) continue
    // 只收正式会话文件，跳过 .after-A/.before-B 这类本地备份
    if (!/^session(\.v\d+)?\.jsonl\.zstd$/.test(f)) continue
    entries.push({ name: `sessions/${key}/${sid}/${f}`, data: fs.readFileSync(fp) })
  }
}
const manifest = { version: 1, workspaces: [{ key, path: workspacePath, title: entry.title, sessions }] }
entries.push({ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') })
fs.writeFileSync(outZip, writeZip(entries))
console.log(`wrote ${outZip} (${entries.length} entries, ${sessions.length} sessions)`)
