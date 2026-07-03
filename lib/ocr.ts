/**
 * Tesseract.js OCR wrapper.
 * - Lazy-initialises the worker on first call to `initOCR()`.
 * - Pre-warm during idle via `prewarmOCR()`.
 * - Applies grayscale + contrast + threshold preprocessing before recognition.
 * - Always cleans up properly; call `terminateOCR()` between sessions if needed.
 */

import type { Worker } from 'tesseract.js'

let worker: Worker | null = null
let initPromise: Promise<void> | null = null
let isTerminated = false

/**
 * Initialise (or re-initialise) the Tesseract worker.
 * Safe to call multiple times — idempotent while worker is alive.
 */
export async function initOCR(): Promise<void> {
  if (worker && !isTerminated) return
  if (initPromise) return initPromise

  initPromise = (async () => {
    const { createWorker } = await import('tesseract.js')
    // Explicitly define CDN paths so Next.js/Turbopack doesn't bundle and corrupt the worker script
    worker = await createWorker('eng', 1, {
      workerPath: 'https://unpkg.com/tesseract.js@7.0.0/dist/worker.min.js',
      corePath: 'https://unpkg.com/tesseract.js-core@6.0.0/tesseract-core.wasm.js',
      // Suppress verbose progress logs in production
      logger: process.env.NODE_ENV === 'development'
        ? (m: unknown) => console.debug('[tesseract]', m)
        : undefined,
    })
    isTerminated = false
  })()

  await initPromise
  initPromise = null
}

/** Pre-warm the OCR worker during idle time (call after detection first passes). */
export async function prewarmOCR(): Promise<void> {
  if (worker && !isTerminated) return
  await initOCR()
}

/**
 * Preprocess an ImageData for better OCR accuracy:
 * grayscale → contrast stretch → binary threshold.
 */
function preprocessForOCR(imageData: ImageData): HTMLCanvasElement {
  const { width, height, data } = imageData

  // Create a processing canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)

  // Get pixel data for manipulation
  const src = ctx.getImageData(0, 0, width, height)
  const pixels = src.data

  // Find min/max luminance for contrast stretching
  let minL = 255
  let maxL = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])
    if (lum < minL) minL = lum
    if (lum > maxL) maxL = lum
  }
  const range = maxL - minL || 1

  // Apply: grayscale + contrast stretch + threshold
  const threshold = 128
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])
    // Contrast stretch
    const stretched = Math.round(((lum - minL) / range) * 255)
    // Binary threshold
    const val = stretched >= threshold ? 255 : 0
    pixels[i] = val
    pixels[i + 1] = val
    pixels[i + 2] = val
    pixels[i + 3] = 255
  }

  ctx.putImageData(src, 0, 0)
  return canvas
}

export interface OCRResult {
  text: string
  confidence: number
}

/**
 * Run OCR on an ImageData.
 * Applies preprocessing and returns raw text + confidence.
 */
export async function recognizeImage(imageData: ImageData): Promise<OCRResult> {
  await initOCR()
  if (!worker) throw new Error('OCR worker failed to initialize')

  const preprocessed = preprocessForOCR(imageData)

  const { data } = await worker.recognize(preprocessed)

  return {
    text: data.text,
    confidence: data.confidence,
  }
}

/**
 * Terminate the Tesseract worker to free memory.
 * Call this when navigating away from the scanner permanently.
 */
export async function terminateOCR(): Promise<void> {
  if (worker) {
    await worker.terminate()
    worker = null
    isTerminated = true
    initPromise = null
  }
}

/** Whether the OCR worker is ready to process. */
export function isOCRReady(): boolean {
  return worker !== null && !isTerminated
}
