/**
 * lib/site.ts — 站点级常量（SEO / OG / sitemap 共用）
 *
 * 部署时设置 NEXT_PUBLIC_APP_URL（如 https://your-project.vercel.app），
 * 本地开发可用 http://localhost:3000，未设置则使用默认占位。
 */

export const SITE_NAME = '小屋日志'
export const SITE_TAGLINE =
  '记录、整理买回家的物品；轻松、用心地过好今天的生活。'

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://him.vercel.app'
).replace(/\/$/, '')
