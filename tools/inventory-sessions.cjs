// 盘点 DSH 全部会话：工作区 / 标题 / tokens / 大小 / 修改时间 → CSV
const fs = require('fs')
const path = require('path')

const HOME = path.join(process.env.APPDATA, 'dsh-desktop', 'harness')
const SESS = path.join(HOME, 'sessions')
const PC = path.join(HOME, 'storages', 'session_projcache', 'sessions')
const out = process.argv[2] || 'inventory.csv'

const rows = []
for (const ws of fs.readdirSync(SESS)) {
  const wsDir = path.join(SESS, ws)
  if (!fs.statSync(wsDir).isDirectory()) continue
  for (const d of fs.readdirSync(wsDir)) {
    const dir = path.join(wsDir, d)
    if (!fs.statSync(dir).isDirectory()) continue
    let title = ''
    let tokens = ''
    const cands = [path.join(PC, d + '.json'), path.join(PC, d.replace(/^session-/, '') + '.json')]
    for (const p of cands) {
      if (!fs.existsSync(p)) continue
      try {
        const j = JSON.parse(fs.readFileSync(p, 'utf8'))
        const r = (j.record && j.record.rows) || {}
        title = (r.title && r.title.val) || ''
        const cp = r.contextPressure && r.contextPressure.val
        if (cp) tokens = cp.surfaceTokens
      } catch {}
      break
    }
    let size = 0
    for (const f of fs.readdirSync(dir)) {
      try { size += fs.statSync(path.join(dir, f)).size } catch {}
    }
    rows.push({ ws, session: d, title, tokens, sizeMB: (size / 1048576).toFixed(2), mtime: fs.statSync(dir).mtime.toISOString() })
  }
}

const csv = ['workspace,session,title,tokens,sizeMB,mtime']
for (const r of rows) csv.push([r.ws, r.session, JSON.stringify(r.title), r.tokens, r.sizeMB, r.mtime].join(','))
fs.writeFileSync(out, csv.join('\n'))

const byWs = {}
for (const r of rows) byWs[r.ws] = (byWs[r.ws] || 0) + 1
console.log('sessions:', rows.length)
console.log('by workspace:', byWs)
const top = rows.filter((r) => r.tokens).sort((a, b) => b.tokens - a.tokens).slice(0, 20)
console.log('top 20 by tokens:')
for (const r of top) console.log('  ', r.tokens, '|', r.title.slice(0, 40), '|', r.session)
