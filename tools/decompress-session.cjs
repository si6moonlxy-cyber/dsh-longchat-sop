// 解压 DSH 会话（多帧 zstd JSONL）→ 输出 .jsonl 到指定路径
const fs = require('fs')
const zlib = require('node:zlib')

const src = process.argv[2]
const dst = process.argv[3]
if (!src || !dst) { console.error('usage: node decompress-session.cjs <in.zstd> <out.jsonl>'); process.exit(1) }
const buf = fs.readFileSync(src)

function tryWhole(b) {
  try {
    const out = zlib.zstdDecompressSync(b)
    const lines = out.toString('utf8').split('\n').filter((l) => l.trim())
    return lines.length > 1 ? out : null
  } catch { return null }
}

function splitFrames(b) {
  const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const positions = []
  for (let i = 0; i <= b.length - 4; i++) {
    if (b[i] === magic[0] && b[i + 1] === magic[1] && b[i + 2] === magic[2] && b[i + 3] === magic[3]) positions.push(i)
  }
  const parts = []
  let k = 0
  while (k < positions.length) {
    let ok = false
    for (let j = k + 1; j <= positions.length; j++) {
      const end = j < positions.length ? positions[j] : b.length
      try {
        parts.push(zlib.zstdDecompressSync(b.subarray(positions[k], end)))
        k = j
        ok = true
        break
      } catch { /* extend to next magic */ }
    }
    if (!ok) { k += 1 }
  }
  return Buffer.concat(parts)
}

const whole = tryWhole(buf)
const out = whole ?? splitFrames(buf)
fs.writeFileSync(dst, out)
const text = out.toString('utf8')
const lines = text.split('\n').filter((l) => l.trim())
console.log('bytes:', out.length, 'lines:', lines.length, 'mode:', whole ? 'single-frame' : 'multi-frame')
