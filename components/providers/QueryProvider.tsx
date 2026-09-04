'use client'

import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * 客户端数据查询 Provider（TanStack Query v5）。
 *
 * 设计要点：
 *   - `useState(() => new QueryClient(...))`：每个浏览器实例 1 个 client，
 *     避免 React Strict Mode 双调用创建两个 client、HMR 抖动
 *   - `staleTime: 30s`：30 秒内重复进入页面不再跨海拉 Supabase（这是大陆部署下
 *     体感加速的核心；超过 30s 会自然拉一次新数据）
 *   - `refetchOnWindowFocus: false`：用户切回 App 不重拉（避免无谓的跨海 RTT）
 *   - `refetchOnMount: 'always'`：组件 mount 时如果数据已 stale 就重拉，否则用缓存
 *
 * 数据写操作（增删改）目前不主动 invalidate——30s 内会自动同步，
 * 后续如需立即同步，可在写操作成功后 `queryClient.invalidateQueries(...)`。
 */
export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnMount: 'always',
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}