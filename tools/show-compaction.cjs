// 读取会话 JSONL，输出 compaction 事件概况与最后一次摘要的结构/关键点
const fs = require('fs')

const f = process.argv[2]
const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim())
const compactions = []
for (const line of lines) {
  let e
  try { e = JSON.parse(line) } catch { continue }
  if (e.type === 'compaction/summary') compactions.push(e)
}
console.log('compaction/summary events:', compactions.length)
for (const c of compactions) {
  console.log('---')
  console.log('shadowedSeqs:', (c.data.shadowedSeqs || []).length, 'shadowedTokenCount:', c.data.shadowedTokenCount)
  const s = c.data.summary || ''
  console.log('summary chars:', s.length)
  console.log('sections:', ['Primary Request', 'Key Technical', 'Files and Code', 'Errors and Fixes', 'Pending Jobs', 'Current Work', 'Next Step', 'Critical Context'].filter((h) => s.includes(h)).join(', '))
  console.log('head:', s.slice(0, 600).replace(/\n/g, ' | '))
}
if (compactions.length) {
  const last = compactions[compactions.length - 1]
  const s = last.data.summary || ''
  console.log('\n=== LAST SUMMARY (' + s.length + ' chars) ===')
  console.log(s.slice(0, 6000))
}
