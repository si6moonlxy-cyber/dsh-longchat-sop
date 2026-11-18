// 统计会话消息尺寸分布，判断压缩可行性（保留尾部是否过大）
const fs = require('fs')

const f = process.argv[2]
const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim())
const msgs = []
for (const line of lines) {
  let e
  try { e = JSON.parse(line) } catch { continue }
  if (e.type !== 'user/message' && e.type !== 'assistant/message' && e.type !== 'tool/result') continue
  const content = e.type === 'tool/result' ? e.data.message.content : e.data.content
  if (!Array.isArray(content)) continue
  let text = ''
  const tools = []
  for (const c of content) {
    if (!c) continue
    if (c.type === 'text') text += c.text || ''
    else if (c.type === 'tool-call') tools.push(c.name)
  }
  msgs.push({ type: e.type, seq: e.seq, chars: text.length, text: text.slice(0, 100).replace(/\n/g, ' '), tools: tools.join(',') })
}
const total = msgs.reduce((s, m) => s + m.chars, 0)
console.log('messages:', msgs.length, 'total chars:', total)
console.log('\n--- top 10 largest ---')
for (const m of [...msgs].sort((a, b) => b.chars - a.chars).slice(0, 10)) {
  console.log(`${m.type} seq=${m.seq} chars=${m.chars} tools=[${m.tools}] :: ${m.text}`)
}
console.log('\n--- last 15 ---')
for (const m of msgs.slice(-15)) {
  console.log(`${m.type} seq=${m.seq} chars=${m.chars} tools=[${m.tools}] :: ${m.text}`)
}
console.log('\n--- first 10 ---')
for (const m of msgs.slice(0, 10)) {
  console.log(`${m.type} seq=${m.seq} chars=${m.chars} :: ${m.text}`)
}
