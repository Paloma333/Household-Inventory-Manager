import { cn } from '@/lib/utils/cn'

/**
 * Skeleton — PRD §2.6
 *
 * 行内用小色块闪烁动画（200ms）
 * 页面级用骨架屏（4 行 + 2 个卡片形状），不用 spinner
 */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 圆形或矩形 */
  variant?: 'rect' | 'circle' | 'text'
}

export function Skeleton({
  className,
  variant = 'rect',
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-wood-soft animate-pulse',
        variant === 'circle' && 'rounded-pill',
        variant === 'rect' && 'rounded-sm',
        variant === 'text' && 'rounded-xs h-3',
        className
      )}
      style={{ animationDuration: '1200ms' }}
      {...rest}
    />
  )
}
