// 压缩质量检查：摘要长度/结构/关键词覆盖；并抽样原始用户提问
const fs = require('fs')

const after = process.argv[2]
const before = process.argv[3]
const digestOut = process.argv[4]

function parse(f) {
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter((l) => l.trim())
  const ev = []
  for (const l of lines) { try { ev.push(JSON.parse(l)) } catch {} }
  return ev
}

const evA = parse(after)
const comp = evA.filter((e) => e.type === 'compaction/summary').pop()
const summaryBlocks = (comp?.data?.summary || []).map((b) => b.text || '').join('\n')
fs.writeFileSync(digestOut, summaryBlocks)
console.log('summary chars:', summaryBlocks.length, '≈ tokens:', Math.round(summaryBlocks.length / 2.5))
const heads = ['Primary Request and Intent', 'Key Technical Concepts', 'Files and Code', 'Errors and Fixes', 'Pending Jobs', 'Current Work', 'Next Step', 'Critical Context']
console.log('sections present:', heads.filter((h) => summaryBlocks.includes(h)).join(' | '))

const keywords = ['斩杀线', '华戎', '以撒', '同轴座', '中望', '简历', 'git log', 'Figma', 'cc-Switch', '表格', '五险一金', '中北控股']
console.log('\nkeyword coverage:')
for (const k of keywords) console.log(' ', k, summaryBlocks.includes(k) ? 'YES' : 'NO')

const evB = parse(before)
const userMsgs = evB.filter((e) => e.type === 'user/message').map((e) => {
  const c = e.data.content || []
  return c.filter((x) => x && x.type === 'text').map((x) => x.text).join(' ')
}).filter(Boolean)
console.log('\noriginal user messages:', userMsgs.length)
console.log('--- sample every 20th ---')
for (let i = 0; i < userMsgs.length; i += 20) console.log(i, '|', userMsgs[i].slice(0, 60).replace(/\n/g, ' '))
