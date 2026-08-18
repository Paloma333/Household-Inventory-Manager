import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * 合并 className — Tailwind 推荐写法。
 * 自动 dedupe 冲突的 Tailwind 类。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
