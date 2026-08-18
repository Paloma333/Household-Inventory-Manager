/**
 * 数量滚动动画 — PRD §4.4
 * 用 rAF 不用 CSS transition，避免 iOS Safari 偶发掉帧。
 * 350ms 内从 previous 滚到 new。
 */
export function animateNumber(
  from: number,
  to: number,
  durationMs = 350,
  onUpdate: (v: number) => void,
  onComplete?: () => void
): () => void {
  if (from === to) {
    onUpdate(to)
    onComplete?.()
    return () => {}
  }

  const start = performance.now()
  let rafId = 0

  const tick = (now: number) => {
    const elapsed = now - start
    const t = Math.min(elapsed / durationMs, 1)
    // ease-out-expo
    const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
    const value = from + (to - from) * eased
    onUpdate(value)
    if (t < 1) {
      rafId = requestAnimationFrame(tick)
    } else {
      onComplete?.()
    }
  }

  rafId = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(rafId)
}
