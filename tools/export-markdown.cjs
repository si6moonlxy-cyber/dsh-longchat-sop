// 把 DSH 会话 JSONL 渲染成可读 Markdown（用户/助手/工具调用）
const fs = require('fs')

const f = process.argv[2]
const out = process.argv[3]
const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim())
const parts = []
let turn = 0
const NOISE = /^(Current runtime context\.|Time sampled while preparing|仅依据当前消息|<dsh_im_source>|<dsh_im_files>|<memory_system>|<calendar>)/m
for (const line of lines) {
  let e
  try { e = JSON.parse(line) } catch { continue }
  if (e.type === 'turn/start') turn = e.data.turn
  if (e.type === 'user/message') {
    const text = (e.data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim()
    if (text && !NOISE.test(text) && !text.includes('<memory_system>')) parts.push(`\n### 用户（轮 ${turn}，seq ${e.seq}）\n\n${text}\n`)
  } else if (e.type === 'assistant/message') {
    const content = e.data.message?.content || []
    const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
    const tools = content.filter((c) => c.type === 'tool-call').map((c) => c.name)
    if (text) parts.push(`\n### 大肥鱼（轮 ${turn}，seq ${e.seq}）\n\n${text}\n`)
    else if (tools.length) parts.push(`\n> [工具调用：${tools.join(', ')}]\n`)
  }
}
fs.writeFileSync(out, parts.join('\n'))
console.log('written:', out, 'chars:', parts.join('\n').length)
