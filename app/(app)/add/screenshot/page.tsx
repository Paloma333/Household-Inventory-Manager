import { RecognitionUploader } from '@/components/recognition/RecognitionUploader'

/**
 * /add/screenshot — 上传购物截图
 * 京东/淘宝/拼多多订单、外卖 APP 都行
 */
export default function ScreenshotPage() {
  return (
    <RecognitionUploader
      sourceType="screenshot"
      title="上传购物截图"
      subtitle="把订单页 / 购物车 / 微信外卖截图发上来，AI 帮你整理"
      example="截图截全一点，最好能看到商品明细"
      accept="image/*"
      ctaLabel="开始识别"
    />
  )
}
