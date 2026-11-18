// compaction-zh: 把 DSH 压缩引擎的英文 8 段指令替换成中文、分领域的保真 checkpoint 指令。
// 做法：包装 ctx.llm.stream；当 purpose === 'compaction' 时，替换最后一条 user 指令。
// 不引入任何外部模块，避免 profile 依赖解析问题。

export const name = 'compaction-zh'
export const inject = ['llm']

const DEFAULT_PROMPT = `你现在是「长会话压缩引擎」。请把上面的对话压缩成一份**中文** checkpoint，让另一个模型读完就能无缝继续，且不丢关键信息。

先判断这段对话属于哪一类，并按对应侧重保留：
- 学习/资料：主题、结论、方法、资源、未决问题
- 情感咨询/陪伴：情绪曲线、关键原话、风险信息、干预与边界
- 角色扮演/人设对话：人设、称呼、语气、口头禅、关系线、梗与禁忌
- 代码/项目：文件路径、命令、错误原文、当前改动

通用规则：
1. 全部用中文输出（引用原文除外）。
2. 逐字保留：关键原话、数字、日期、路径、链接、账号/ID、错误字符串、承诺与边界。
3. 区分「事实」与「推测」；推测标注「（假设）」。
4. 不评判、不美化、不编造；不确定就写「未确认」。
5. 不要提到「压缩 / 摘要 / checkpoint / 上下文」这件事。

必须保留以下结构（一节都不能少；没有内容写「无」）：
## 一、这段对话是什么
- 类型 / 参与者 / 时间跨度 / 当前状态（一句话）

## 二、用户画像与背景（稳定事实）
- 身份、处境、关系、目标、长期约束

## 三、时间线与关键事件
- 时间 → 发生了什么 → 用户的反应 → 助手的干预

## 四、关键原话（逐字）
- 「……」——当时的上下文

## 五、风险与安全（不可省略）
- 自伤/自杀/危机语句的原文与时间；无则写「本次无」

## 六、模式与假设
- 可复用的行为模式；标注哪些是假设

## 七、未决与下一步
- 待办、未回答的问题、下次要接的点

## 八、语气与人设（如适用）
- 助手自称、对用户的称呼、句长与分段、表情习惯、口头禅；禁忌

只输出这份 checkpoint 正文，不要调用工具，不要解释。`

export function apply(ctx, config) {
  const llm = (ctx.get && ctx.get('llm')) || ctx.llm
  if (!llm || typeof llm.stream !== 'function') {
    ctx.logger?.warn?.('compaction-zh: llm.stream not found; skipped')
    return
  }
  if (llm.__compactionZhPatched) return
  llm.__compactionZhPatched = true

  const original = llm.stream.bind(llm)
  const prompt = (config && typeof config.prompt === 'string' && config.prompt.trim()) || DEFAULT_PROMPT

  llm.stream = function patchedStream(options, ...rest) {
    try {
      if (options && options.purpose === 'compaction' && Array.isArray(options.messages) && options.messages.length > 0) {
        const messages = options.messages.slice()
        const last = messages[messages.length - 1]
        if (last && last.role === 'user' && Array.isArray(last.content)) {
          messages[messages.length - 1] = {
            ...last,
            content: [{ type: 'text', text: prompt }],
          }
          options = { ...options, messages }
        }
      }
    } catch (error) {
      ctx.logger?.warn?.(`compaction-zh: rewrite failed: ${error && error.message ? error.message : error}`)
    }
    return original(options, ...rest)
  }

  ctx.logger?.info?.('compaction-zh: loaded; compaction instruction is now Chinese')
}
