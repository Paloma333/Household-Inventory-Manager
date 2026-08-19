import type { AiAdapter, RecognitionResult, SourceType } from './types'
import { qwenAdapter, getDashScopeKey } from './qwen'
import { mockRecognize } from './mock'

/**
 * 决定走 mock 还是真实 Qwen-VL-Plus：
 * - MOCK_AI=1 → mock
 * - DASHSCOPE_API_KEY / QWEN_API_KEY 都没设置 → mock
 * - 否则 → qwen-vl-plus
 *
 * 注意：MOCK 模式下 tokens_used = 0，不计入月度配额
 */
export function shouldUseMock(): boolean {
  if (process.env.MOCK_AI === '1') return true
  if (!getDashScopeKey()) return true
  return false
}

export function getAiAdapter(): AiAdapter {
  if (shouldUseMock()) {
    return {
      recognize: (opts) => mockRecognize({ imageUrl: opts.imageUrl, sourceType: opts.sourceType }),
    }
  }
  return qwenAdapter
}

export async function recognizeWithLog(opts: {
  imageUrl: string
  sourceType: SourceType
}): Promise<RecognitionResult> {
  const adapter = getAiAdapter()
  return adapter.recognize(opts)
}
