'use client'

import { useRef, useCallback, useEffect } from 'react'

/**
 * Ring buffer of ImageData frames captured from the video stream.
 * Frames live only in memory — never persisted anywhere.
 * Old frames are evicted automatically when the buffer is full.
 */

const BUFFER_SIZE = 15 // ~1 second at 15fps

interface FrameEntry {
  imageData: ImageData
  timestamp: number
  blurScore?: number // lazily computed
}

export function useFrameBuffer(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const bufferRef = useRef<FrameEntry[]>([])
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureIntervalRef = useRef<number | null>(null)

  const getCaptureCanvas = useCallback((width: number, height: number): HTMLCanvasElement => {
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas')
    }
    const c = captureCanvasRef.current
    if (c.width !== width) c.width = width
    if (c.height !== height) c.height = height
    return c
  }, [])

  /**
   * Capture a single frame from the video element into the ring buffer.
   */
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.paused) return

    const { videoWidth, videoHeight } = video
    if (videoWidth === 0 || videoHeight === 0) return

    try {
      const canvas = getCaptureCanvas(videoWidth, videoHeight)
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      ctx.drawImage(video, 0, 0, videoWidth, videoHeight)
      const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight)

      const entry: FrameEntry = {
        imageData,
        timestamp: Date.now(),
      }

      // Evict oldest frame if buffer is full
      if (bufferRef.current.length >= BUFFER_SIZE) {
        bufferRef.current.shift()
      }
      bufferRef.current.push(entry)
    } catch {
      // Frame capture can fail if video is in an odd state — ignore
    }
  }, [videoRef, getCaptureCanvas])

  /**
   * Start the frame capture loop at ~15fps (every 67ms).
   */
  const startCapture = useCallback(() => {
    if (captureIntervalRef.current !== null) return
    captureIntervalRef.current = window.setInterval(captureFrame, 67)
  }, [captureFrame])

  /**
   * Stop the frame capture loop.
   */
  const stopCapture = useCallback(() => {
    if (captureIntervalRef.current !== null) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
  }, [])

  /**
   * Flush all buffered frames (call after Read completes to free memory).
   */
  const flushBuffer = useCallback(() => {
    bufferRef.current = []
  }, [])

  /**
   * Select the sharpest frame from the buffer using Laplacian variance.
   * Returns null if the buffer is empty.
   */
  const selectBestFrame = useCallback((): ImageData | null => {
    const buffer = bufferRef.current
    if (buffer.length === 0) return null

    let bestFrame = buffer[buffer.length - 1].imageData
    let bestScore = -Infinity

    for (const entry of buffer) {
      // Compute blur score if not already cached
      if (entry.blurScore === undefined) {
        entry.blurScore = computeQuickLaplacian(entry.imageData)
      }
      if (entry.blurScore > bestScore) {
        bestScore = entry.blurScore
        bestFrame = entry.imageData
      }
    }

    return bestFrame
  }, [])

  /** Current buffer size */
  const getBufferSize = useCallback(() => bufferRef.current.length, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCapture()
      flushBuffer()
    }
  }, [stopCapture, flushBuffer])

  return {
    startCapture,
    stopCapture,
    flushBuffer,
    selectBestFrame,
    getBufferSize,
  }
}

/**
 * Fast Laplacian variance on a downsampled region of the frame.
 * Sampled every Nth pixel for speed.
 */
function computeQuickLaplacian(imageData: ImageData): number {
  const { width, height, data } = imageData
  const step = Math.max(1, Math.floor(Math.min(width, height) / 64))

  // Convert to grayscale, sampled
  const gray: number[] = []
  const sWidth = Math.floor(width / step)
  const sHeight = Math.floor(height / step)

  for (let y = 0; y < sHeight; y++) {
    for (let x = 0; x < sWidth; x++) {
      const srcIdx = (y * step * width + x * step) * 4
      const lum = 0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2]
      gray.push(lum)
    }
  }

  // Laplacian on the sampled grid
  let sum = 0
  let sumSq = 0
  let count = 0

  for (let y = 1; y < sHeight - 1; y++) {
    for (let x = 1; x < sWidth - 1; x++) {
      const idx = y * sWidth + x
      const lap =
        gray[idx - sWidth] + gray[idx + sWidth] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx]
      sum += lap
      sumSq += lap * lap
      count++
    }
  }

  if (count === 0) return 0
  const mean = sum / count
  return sumSq / count - mean * mean
}
