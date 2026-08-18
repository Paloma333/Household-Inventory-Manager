import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // 登录后才能用的页面 + 用户私有数据（分享链接 / API）不收录
      disallow: [
        '/api/',
        '/r/',
        '/drafts',
        '/trash',
        '/settings',
        '/confirm',
        '/add',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
