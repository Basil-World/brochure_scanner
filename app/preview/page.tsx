'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OCRPreview } from '@/components/OCRPreview'
import { useSessionStore } from '@/lib/sessionStore'

export default function PreviewPage() {
  const router = useRouter()
  const { currentScan } = useSessionStore()

  // If navigated here without scan data, go back to scanner
  useEffect(() => {
    if (!currentScan) {
      router.replace('/scanner')
    }
  }, [currentScan, router])

  if (!currentScan) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <OCRPreview initialFields={currentScan} />
}
