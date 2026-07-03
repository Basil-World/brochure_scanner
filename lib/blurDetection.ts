import type { BlurDetectionResult } from '@/lib/types'

/**
 * Compute variance of the Laplacian on an ImageData region.
 * Higher variance = sharper image.
 *
 * The Laplacian kernel highlights edges/high-frequency detail.
 * A blurry image has low Laplacian variance because edges are smoothed out.
 */
function laplacianVariance(imageData: ImageData): number {
  const { width, height, data } = imageData

  // Convert to grayscale first
  const gray: number[] = new Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b
  }

  // Apply Laplacian kernel:
  //  0  1  0
  //  1 -4  1
  //  0  1  0
  let sum = 0
  let sumSq = 0
  let count = 0

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      const lap =
        gray[idx - width] +       // top
        gray[idx + width] +       // bottom
        gray[idx - 1] +           // left
        gray[idx + 1] -           // right
        4 * gray[idx]             // center

      sum += lap
      sumSq += lap * lap
      count++
    }
  }

  if (count === 0) return 0
  const mean = sum / count
  const variance = sumSq / count - mean * mean
  return variance
}

/**
 * Detect whether an image region is sharp enough for OCR.
 *
 * @param imageData The image region (ideally the cropped ROI)
 * @param threshold Laplacian variance threshold — below this = blurry. Default 100.
 */
export function detectBlur(
  imageData: ImageData,
  threshold = 100
): BlurDetectionResult {
  // Downsample to a manageable size for performance (max 320×240)
  const maxDim = 320
  let procData = imageData

  if (imageData.width > maxDim || imageData.height > maxDim) {
    const scale = Math.min(maxDim / imageData.width, maxDim / imageData.height)
    const tw = Math.round(imageData.width * scale)
    const th = Math.round(imageData.height * scale)

    try {
      const offscreen = new OffscreenCanvas(tw, th)
      const ctx = offscreen.getContext('2d')!
      const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height)
      const srcCtx = srcCanvas.getContext('2d')!
      srcCtx.putImageData(imageData, 0, 0)
      ctx.drawImage(srcCanvas, 0, 0, tw, th)
      procData = ctx.getImageData(0, 0, tw, th)
    } catch {
      // Fall back to processing original if OffscreenCanvas fails
    }
  }

  const score = laplacianVariance(procData)

  return {
    sharp: score >= threshold,
    score,
  }
}
