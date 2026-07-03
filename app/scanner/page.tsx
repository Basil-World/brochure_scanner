'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CameraView } from '@/components/CameraView'
import { CropOverlay, defaultCropBox } from '@/components/CropOverlay'
import { StatusIndicator } from '@/components/StatusIndicator'
import { BottomToolbar } from '@/components/BottomToolbar'
import { useCamera } from '@/hooks/useCamera'
import { useFrameBuffer } from '@/hooks/useFrameBuffer'
import { useDocumentChecks } from '@/hooks/useDocumentChecks'
import { useReadiness } from '@/hooks/useReadiness'
import { useSessionStore } from '@/lib/sessionStore'
import { OCRPreview } from '@/components/OCRPreview'
import { cropImageData, mapCropBoxToVideoSpace, applyPerspectiveCorrection } from '@/lib/perspectiveCorrect'
import { recognizeImage, prewarmOCR } from '@/lib/ocr'
import { decodeQR } from '@/lib/qrScanner'
import { extractFields } from '@/lib/fieldExtraction'
import type { CropBox, ReadState } from '@/lib/types'
import { CROP_PRESETS } from '@/lib/types'

const CROP_SIZE_KEY = 'expo_ocr_crop_size'

function loadCropSize(): { width: number; height: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CROP_SIZE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveCropSize(width: number, height: number) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CROP_SIZE_KEY, JSON.stringify({ width, height }))
  } catch {}
}

export default function ScannerPage() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [cropBox, setCropBox] = useState<CropBox | null>(null)
  const [readState, setReadState] = useState<ReadState>('idle')
  const [readError, setReadError] = useState<string | null>(null)

  const { settings, records, currentScan, setCurrentScan } = useSessionStore()

  // Camera
  const { videoRef, permission, error, isRearCamera, devices, activeDeviceId, retryPermission, switchCamera } =
    useCamera({ preferredDeviceId: settings.selectedDeviceId })

  // Frame buffer
  const { startCapture, stopCapture, flushBuffer, selectBestFrame } = useFrameBuffer(videoRef)

  // Detection — only when camera is granted and not reading
  const detectionEnabled = permission === 'granted' && readState === 'idle'
  const { status } = useDocumentChecks({
    videoRef,
    cropBox,
    enabled: detectionEnabled,
    settings,
  })

  // Readiness
  const { canRead } = useReadiness(status)

  // Measure container for crop overlay
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Initialise crop box once container is sized
  useEffect(() => {
    if (containerSize.width === 0 || cropBox !== null) return
    const preset = CROP_PRESETS[settings.cropPreset]
    const savedSize = loadCropSize()
    const base = defaultCropBox(containerSize.width, containerSize.height, preset.aspectRatio)
    if (savedSize) {
      // Use saved size, recentre
      const w = Math.min(savedSize.width, containerSize.width * 0.95)
      const h = Math.min(savedSize.height, containerSize.height * 0.90)
      setCropBox({
        x: Math.round((containerSize.width - w) / 2),
        y: Math.round((containerSize.height - h) / 2),
        width: w,
        height: h,
      })
    } else {
      setCropBox(base)
    }
  }, [containerSize, cropBox, settings.cropPreset])

  // Persist crop size on change
  const handleCropChange = useCallback((box: CropBox) => {
    setCropBox(box)
    saveCropSize(box.width, box.height)
  }, [])

  const handleCropReset = useCallback(() => {
    if (containerSize.width === 0) return
    const preset = CROP_PRESETS[settings.cropPreset]
    const box = defaultCropBox(containerSize.width, containerSize.height, preset.aspectRatio)
    setCropBox(box)
    saveCropSize(box.width, box.height)
  }, [containerSize, settings.cropPreset])

  // Start/stop frame buffer capture when camera is ready
  useEffect(() => {
    if (permission === 'granted') {
      startCapture()
      // Pre-warm OCR worker during idle
      prewarmOCR().catch(() => {})
    } else {
      stopCapture()
    }
    return () => stopCapture()
  }, [permission, startCapture, stopCapture])

  // Cycle through available cameras
  const handleSwitchCamera = useCallback(() => {
    if (devices.length < 2) return
    const currentIndex = devices.findIndex(d => d.deviceId === activeDeviceId)
    const nextIndex = (currentIndex + 1) % devices.length
    const nextDevice = devices[nextIndex]
    if (nextDevice) {
      switchCamera(nextDevice.deviceId)
    }
  }, [devices, activeDeviceId, switchCamera])

  // ── Read Pipeline ──────────────────────────────────────────────────────────

  const handleRead = useCallback(async () => {
    if (!canRead || readState !== 'idle' || !cropBox) return
    if (!videoRef.current) return

    // Haptic on press
    if ('vibrate' in navigator) navigator.vibrate(30)

    setReadState('capturing')
    setReadError(null)

    try {
      // 1. Select best frame from buffer
      const bestFrame = selectBestFrame()
      if (!bestFrame) throw new Error('No frames captured yet — please try again')

      // 2. Map crop box from display coords to video resolution
      const video = videoRef.current
      const rect = video.getBoundingClientRect()
      const videoCropBox = mapCropBoxToVideoSpace(
        cropBox,
        rect.width,
        rect.height,
        video.videoWidth,
        video.videoHeight
      )

      // 3. Crop to ROI
      const cropped = cropImageData(bestFrame, videoCropBox)

      // 4. Perspective correction (skip if corners unavailable)
      setReadState('correcting')
      let corrected = cropped
      if (status.document.corners) {
        // Remap corners from video space to cropped space
        const offsetCorners = status.document.corners.map(p => ({
          x: p.x - videoCropBox.x,
          y: p.y - videoCropBox.y,
        })) as [typeof status.document.corners[0], typeof status.document.corners[0], typeof status.document.corners[0], typeof status.document.corners[0]]
        corrected = applyPerspectiveCorrection(cropped, offsetCorners)
      }

      // 5. OCR
      setReadState('ocr')
      const ocrResult = await recognizeImage(corrected)

      // 6. QR detection (parallel — same cropped frame)
      setReadState('qr')
      const qrLink = await decodeQR(corrected)

      // 7. Field extraction
      setReadState('extracting')
      const extracted = extractFields(ocrResult.text, qrLink ?? '')

      // 8. Flush all frames and intermediates
      flushBuffer()

      // 9. Store result and render preview overlay
      setCurrentScan(extracted)
      setReadState('idle')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setReadError(msg)
      setReadState('idle')
      flushBuffer()
    }
  }, [
    canRead,
    readState,
    cropBox,
    videoRef,
    status.document.corners,
    selectBestFrame,
    flushBuffer,
    setCurrentScan,
    router,
  ])

  const isProcessing = readState !== 'idle' && readState !== 'error'

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" ref={containerRef}>
      {/* OCR Preview Overlay */}
      {currentScan && (
        <div className="absolute inset-0 z-50 bg-neutral-950">
          <OCRPreview 
            initialFields={currentScan} 
            onClose={() => setCurrentScan(null)} 
          />
        </div>
      )}

      {/* Camera + overlays */}
      <CameraView
        videoRef={videoRef}
        permission={permission}
        error={error}
        isRearCamera={isRearCamera}
        onRetry={retryPermission}
        className="absolute inset-0"
      />

      {/* Crop overlay */}
      {permission === 'granted' && cropBox && (
        <CropOverlay
          cropBox={cropBox}
          onChange={handleCropChange}
          onReset={handleCropReset}
          containerWidth={containerSize.width}
          containerHeight={containerSize.height}
          disabled={isProcessing}
        />
      )}

      {/* Status indicators — top-left inside crop box area */}
      {permission === 'granted' && cropBox && !isProcessing && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            top: cropBox.y + 8,
            left: cropBox.x + 8,
            right: containerSize.width - cropBox.x - cropBox.width + 8,
          }}
        >
          <StatusIndicator status={status} />
        </div>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-neutral-950/70 backdrop-blur-sm">
          <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-cyan-300 font-medium capitalize">
            {readState === 'capturing' && 'Selecting best frame…'}
            {readState === 'correcting' && 'Correcting perspective…'}
            {readState === 'ocr' && 'Running OCR…'}
            {readState === 'qr' && 'Decoding QR…'}
            {readState === 'extracting' && 'Extracting fields…'}
          </p>
        </div>
      )}

      {/* Read error */}
      {readError && (
        <div className="absolute top-16 left-4 right-4 z-20">
          <div className="rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm text-red-300 flex items-start gap-2">
            <span className="flex-shrink-0 mt-0.5">⚠</span>
            <span>{readError}</span>
          </div>
        </div>
      )}

      {/* Switch Camera Button */}
      {permission === 'granted' && devices.length > 1 && (
        <button
          onClick={handleSwitchCamera}
          className="absolute top-4 right-4 z-30 p-3 rounded-full bg-neutral-900/50 backdrop-blur-md border border-neutral-700/50 text-white active:scale-95 transition-transform"
          aria-label="Switch camera"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      )}

      {/* Bottom toolbar */}
      <BottomToolbar
        onRead={handleRead}
        readDisabled={!canRead || isProcessing}
        readState={isProcessing ? 'processing' : 'idle'}
        savedCount={records.length}
      />
    </div>
  )
}
