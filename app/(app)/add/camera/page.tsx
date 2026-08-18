import { RecognitionUploader } from '@/components/recognition/RecognitionUploader'

/**
 * /add/camera — 拍照识物
 * 拍冰箱、储物柜、桌面，AI 找候选
 */
export default function CameraPage() {
  return (
    <RecognitionUploader
      sourceType="camera"
      title="拍照识物"
      subtitle="拍一整片地方，让 AI 帮你发现还剩什么"
      example="把想清点的角落拍下来，灯打亮点"
      accept="image/*"
      capture="environment"
      ctaLabel="开始识别"
    />
  )
}
