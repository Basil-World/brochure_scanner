import type { StabilityDetectionResult } from '@/lib/types'

/** Ring buffer to hold recent motion scores for rolling window stability check */
const motionScoreHistory: { score: number; timestamp: number }[] = []
const MAX_HISTORY_MS = 1500 // Keep up to 1.5 seconds of history

/**
 * Compare two downsampled grayscale frames using Mean Absolute Difference (MAD).
 * Returns a motion score — lower = more stable.
 *
 * @param prev Previous grayscale pixel data (Uint8ClampedArray)
 * @param curr Current grayscale pixel data (Uint8ClampedArray)
 */
function computeMotionScore(prev: Uint8ClampedArray, curr: Uint8ClampedArray): number {
  if (prev.length !== curr.length || prev.length === 0) return 0
  let sum = 0
  for (let i = 0; i < prev.length; i++) {
    sum += Math.abs(prev[i] - curr[i])
  }
  return sum / prev.length
}

/**
 * Downsample an ImageData region to a small grayscale array for fast comparison.
 * Downsampling to ~64×36 pixels is sufficient for motion detection.
 */
export function extractDownsampledGray(imageData: ImageData, targetWidth = 64, targetHeight = 36): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(targetWidth, targetHeight)
  const ctx = canvas.getContext('2d')!
  // Draw the source image scaled down
  const tempCanvas = new OffscreenCanvas(imageData.width, imageData.height)
  const tempCtx = tempCanvas.getContext('2d')!
  tempCtx.putImageData(imageData, 0, 0)
  ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight)
  const small = ctx.getImageData(0, 0, targetWidth, targetHeight)
  // Convert to grayscale (luminance)
  const gray = new Uint8ClampedArray(targetWidth * targetHeight)
  for (let i = 0; i < gray.length; i++) {
    const r = small.data[i * 4]
    const g = small.data[i * 4 + 1]
    const b = small.data[i * 4 + 2]
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  }
  return gray
}

let prevGray: Uint8ClampedArray | null = null

/**
 * Detect motion between consecutive frames using frame differencing.
 *
 * @param currentGray Downsampled grayscale data of the current frame
 * @param stabilityWindowMs Rolling window duration in milliseconds
 * @param motionThreshold MAD threshold below which a frame is considered "stable"
 */
export function detectStability(
  currentGray: Uint8ClampedArray,
  stabilityWindowMs = 1000,
  motionThreshold = 15 // Increased from 5 to 15 to allow for natural hand shake
): StabilityDetectionResult {
  const now = Date.now()

  // Compute motion vs previous frame
  let score = 0
  if (prevGray) {
    score = computeMotionScore(prevGray, currentGray)
  }
  prevGray = currentGray

  // Add to rolling history
  motionScoreHistory.push({ score, timestamp: now })

  // Prune old entries outside the window + safety cap
  while (
    motionScoreHistory.length > 0 &&
    now - motionScoreHistory[0].timestamp > MAX_HISTORY_MS
  ) {
    motionScoreHistory.shift()
  }

  // Need at least enough samples to cover the stability window
  const windowStart = now - stabilityWindowMs
  const windowScores = motionScoreHistory.filter(e => e.timestamp >= windowStart)

  // Stable if we have enough history AND all recent scores are below threshold
  const hasEnoughHistory = motionScoreHistory[0]?.timestamp <= now - stabilityWindowMs * 0.8
  const allBelowThreshold = windowScores.length > 0 && windowScores.every(e => e.score <= motionThreshold)

  return {
    stable: hasEnoughHistory && allBelowThreshold,
    motionScore: score,
  }
}

/** Reset motion history (call when switching tabs or restarting camera) */
export function resetStabilityHistory(): void {
  motionScoreHistory.length = 0
  prevGray = null
}
