import './globals.css'
import type { Metadata, Viewport } from 'next'
import { ToastViewport } from '@/components/ui/Toast'

export const metadata: Metadata = {
  title: '小家',
  description: '一个让 AI 帮你记住家里有什么的治愈系库存工具',
  applicationName: '小家',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '小家',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#F6F1E7',
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
        {children}
        <ToastViewport />
      </body>
    </html>
  )
}
