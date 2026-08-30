import { RecognitionUploader } from '@/components/recognition/RecognitionUploader'

/**
 * /add/receipt — 拍小票
 * Sprint 2 启用
 */
export default function ReceiptPage() {
  return (
    <RecognitionUploader
      sourceType="receipt"
      title="拍张小票"
      subtitle="给超市购物小票拍张照，AI帮你整理买的东西～"
      example="把小票放平整、对好光，字朝镜头"
      accept="image/*"
      capture="environment"
      ctaLabel="开始识别"
      maxPhotos={5}
    />
  )
}
