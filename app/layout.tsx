/* animal-island-ui 全局样式（字体 + --animal-* 变量 + 组件样式）
 * 必须先于 globals.css 引入，这样我们的 :root 覆盖才能赢过库默认值 */
import 'animal-island-ui/style'
import './globals.css'
import type { Metadata, Viewport } from 'next'
import { ToastViewport } from '@/components/ui/Toast'
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'

const DEFAULT_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-192.svg',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: DEFAULT_TITLE,
    description: SITE_TAGLINE,
    locale: 'zh_CN',
    url: '/',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: DEFAULT_TITLE,
    description: SITE_TAGLINE,
    images: ['/og.png'],
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F8F8F0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 防止 hydration mismatch(data-theme 是动态 attr)
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* inline script 在 hydrate 前设置 theme,避免闪屏 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('him-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-bg-canvas text-ink-primary antialiased">
        {/* 手机端大小：固定 480px 居中，大屏只显示手机宽度（外侧 cream bg 与内无缝衔接） */}
        <div className="mx-auto w-full max-w-[480px] min-h-screen relative">
          {children}
        </div>
        <ToastViewport />
      </body>
    </html>
  )
}
