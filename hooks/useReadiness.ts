'use client'

import { useState, useEffect } from 'react'
import type { DetectionStatus } from '@/lib/types'
import { isOCRReady } from '@/lib/ocr'

interface UseReadinessResult {
  canRead: boolean
  reason: string | null
}

/**
 * Derives whether the Read button should be enabled.
 * All conditions must pass:
 * 1. Document detected
 * 2. Frame is stable
 * 3. Frame is sharp
 * 4. OCR library is loaded (or at least not known to have failed)
 */
export function useReadiness(status: DetectionStatus): UseReadinessResult {
  const [ocrLoaded, setOcrLoaded] = useState(false)

  // Check OCR readiness — poll briefly since the worker may still be initialising
  useEffect(() => {
    if (isOCRReady()) {
      setOcrLoaded(true)
      return
    }
    // Tesseract pre-warms asynchronously; check every 500ms
    const interval = setInterval(() => {
      if (isOCRReady()) {
        setOcrLoaded(true)
        clearInterval(interval)
      }
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // We no longer block on document detection, because manual cropping is available
  // if (!status.document.detected) {
  //   return { canRead: false, reason: 'No document detected' }
  // }
  if (!status.stability.stable) {
    return { canRead: false, reason: 'Hold the camera steady' }
  }
  if (!status.blur.sharp) {
    return { canRead: false, reason: 'Image is blurry' }
  }
  // Note: we allow Read even if OCR hasn't pre-warmed, since it will init on demand
  // but we show a hint if libraries are clearly not ready

  return { canRead: true, reason: null }
}
