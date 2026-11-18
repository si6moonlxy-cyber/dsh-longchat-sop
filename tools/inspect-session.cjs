// 读取 DSH 会话文件（zstd JSONL），打印事件类型分布与消息尺寸概况
const fs = require('fs')
const zlib = require('node:zlib')

const p = process.argv[2]
if (!p) { console.error('usage: node inspect-session.cjs <session.v4.jsonl.zstd>'); process.exit(1) }
const raw = zlib.zstdDecompressSync(fs.readFileSync(p)).toString('utf8')
const lines = raw.split('\n').filter((l) => l.trim().length > 0)
console.log('lines:', lines.length)

const counts = new Map()
const samples = new Map()
for (const line of lines) {
  let e
  try { e = JSON.parse(line) } catch { continue }
  counts.set(e.type, (counts.get(e.type) || 0) + 1)
  if (!samples.has(e.type)) samples.set(e.type, line)
}
console.log('event types:')
for (const [t, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log('  ', t, n)
console.log('\n--- sample lines (first 300 chars each) ---')
for (const [t, s] of samples) console.log('\n[' + t + ']', s.slice(0, 300))
