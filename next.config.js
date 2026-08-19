/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 沙箱环境限制批量删除 .next 时，可用 NEXT_DIST_DIR=.next-verify 换目录构建
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  experimental: {
    // 让 client / server 共享 @supabase/ssr 实例
    serverActions: { bodySizeLimit: '8mb' },
  },
}

module.exports = nextConfig
