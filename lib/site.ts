/**
 * lib/site.ts — 站点级常量（SEO / OG / sitemap 共用）
 *
 * 部署时设置 NEXT_PUBLIC_APP_URL（如 https://your-project.vercel.app），
 * 本地开发可用 http://localhost:3000，未设置则使用默认占位。
 */

export const SITE_NAME = '小家'
export const SITE_TAGLINE = '让 AI 帮你记住家里有什么的治愈系库存工具'

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://him.vercel.app'
).replace(/\/$/, '')
