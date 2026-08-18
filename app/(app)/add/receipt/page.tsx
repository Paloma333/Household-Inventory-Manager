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
      subtitle="超市购物小票对着拍就行，AI 帮你把商品都拎出来"
      example="把小票放平整、对好光，字朝镜头"
      accept="image/*"
      capture="environment"
      ctaLabel="开始识别"
    />
  )
}
