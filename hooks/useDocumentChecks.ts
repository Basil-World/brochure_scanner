'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { DetectionStatus, CropBox, AppSettings } from '@/lib/types'
import { detectDocument } from '@/lib/documentDetection'
import { detectBlur } from '@/lib/blurDetection'
import { detectStability, extractDownsampledGray, resetStabilityHistory } from '@/lib/stabilityDetection'

const ANALYSIS_INTERVAL_MS = 120 // ~8 analyses/sec — protects battery

interface UseDocumentChecksOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cropBox: CropBox | null
  enabled: boolean
  settings: Pick<AppSettings, 'blurThreshold' | 'stabilityWindow'>
}

export function useDocumentChecks({
  videoRef,
  cropBox,
  enabled,
  settings,
}: UseDocumentChecksOptions) {
  const [status, setStatus] = useState<DetectionStatus>({
    document: { detected: false, confidence: 0 },
    stability: { stable: false, motionScore: 0 },
    blur: { sharp: false, score: 0 },
    ready: false,
  })

  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const intervalRef = useRef<number | null>(null)

  const getAnalysisCanvas = useCallback((w: number, h: number): HTMLCanvasElement => {
    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas')
    }
    const c = analysisCanvasRef.current
    if (c.width !== w) c.width = w
    if (c.height !== h) c.height = h
    return c
  }, [])

  const runAnalysis = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.paused) return
    if (!cropBox) return

    const { videoWidth, videoHeight } = video
    if (videoWidth === 0 || videoHeight === 0) return

    try {
      // Map crop box from display to video coords
      const rect = video.getBoundingClientRect()
      const scaleX = videoWidth / rect.width
      const scaleY = videoHeight / rect.height

      const roiX = Math.max(0, Math.round(cropBox.x * scaleX))
      const roiY = Math.max(0, Math.round(cropBox.y * scaleY))
      const roiW = Math.min(Math.round(cropBox.width * scaleX), videoWidth - roiX)
      const roiH = Math.min(Math.round(cropBox.height * scaleY), videoHeight - roiY)

      if (roiW <= 0 || roiH <= 0) return

      const canvas = getAnalysisCanvas(roiW, roiH)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      // Draw only the ROI region
      ctx.drawImage(video, roiX, roiY, roiW, roiH, 0, 0, roiW, roiH)
      const imageData = ctx.getImageData(0, 0, roiW, roiH)

      // Run all three detections
      const docResult = detectDocument(imageData)
      const blurResult = detectBlur(imageData, settings.blurThreshold)

      // Stability needs downsampled grayscale
      const grayData = extractDownsampledGray(imageData)
      const stabilityResult = detectStability(grayData, settings.stabilityWindow)

      const ready = docResult.detected && blurResult.sharp && stabilityResult.stable

      setStatus({
        document: docResult,
        stability: stabilityResult,
        blur: blurResult,
        ready,
      })
    } catch {
      // Analysis errors are non-fatal — just skip this frame
    }
  }, [videoRef, cropBox, settings, getAnalysisCanvas])

  // Start/stop the analysis loop based on `enabled`
  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      resetStabilityHistory()
      return
    }

    intervalRef.current = window.setInterval(runAnalysis, ANALYSIS_INTERVAL_MS)
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, runAnalysis])

  // Pause analysis when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        resetStabilityHistory()
      } else if (enabled) {
        intervalRef.current = window.setInterval(runAnalysis, ANALYSIS_INTERVAL_MS)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled, runAnalysis])

  return { status }
}
