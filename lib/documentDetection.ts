import type { DocumentDetectionResult, Point } from '@/lib/types'

// Declare the global cv object loaded via OpenCV.js script tag
declare const cv: {
  matFromImageData: (imageData: ImageData) => CvMat
  cvtColor: (src: CvMat, dst: CvMat, code: number) => void
  GaussianBlur: (src: CvMat, dst: CvMat, ksize: CvSize, sigmaX: number) => void
  Canny: (src: CvMat, dst: CvMat, threshold1: number, threshold2: number) => void
  findContours: (
    image: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number
  ) => void
  contourArea: (contour: CvMat) => number
  arcLength: (contour: CvMat, closed: boolean) => number
  approxPolyDP: (curve: CvMat, approxCurve: CvMat, epsilon: number, closed: boolean) => void
  Mat: new () => CvMat
  MatVector: new () => CvMatVector
  Size: new (w: number, h: number) => CvSize
  COLOR_RGBA2GRAY: number
  RETR_EXTERNAL: number
  CHAIN_APPROX_SIMPLE: number
}

interface CvMat {
  delete: () => void
  rows: number
  cols: number
  data32F: Float32Array
  intAt: (row: number, col: number) => number
}

interface CvMatVector {
  size: () => number
  get: (index: number) => CvMat
  delete: () => void
}

interface CvSize {
  width: number
  height: number
}

function isCvAvailable(): boolean {
  return typeof cv !== 'undefined' && cv != null
}

/**
 * Detect whether a document-like rectangular object fills a reasonable portion of the ROI.
 * Uses OpenCV.js: grayscale → GaussianBlur → Canny → findContours → approxPolyDP.
 * Falls back to { detected: false } if OpenCV is not loaded yet.
 */
export function detectDocument(
  imageData: ImageData,
  minFillRatio = 0.15
): DocumentDetectionResult {
  if (!isCvAvailable()) {
    return { detected: false, confidence: 0 }
  }

  let src: CvMat | null = null
  let gray: CvMat | null = null
  let blurred: CvMat | null = null
  let edges: CvMat | null = null
  let contours: CvMatVector | null = null
  let hierarchy: CvMat | null = null
  let approx: CvMat | null = null

  try {
    src = cv.matFromImageData(imageData)
    gray = new cv.Mat()
    blurred = new cv.Mat()
    edges = new cv.Mat()
    contours = new cv.MatVector()
    hierarchy = new cv.Mat()

    // Convert to grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

    // Gaussian blur to reduce noise
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)

    // Canny edge detection
    cv.Canny(blurred, edges, 50, 150)

    // Find contours
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    const totalArea = imageData.width * imageData.height
    let bestContour: CvMat | null = null
    let bestArea = 0
    let bestCorners: [Point, Point, Point, Point] | undefined

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const area = cv.contourArea(contour)

      if (area < totalArea * minFillRatio) continue

      // Approximate to polygon
      approx = new cv.Mat()
      const perimeter = cv.arcLength(contour, true)
      cv.approxPolyDP(contour, approx, 0.02 * perimeter, true)

      // Look for quadrilateral (4 corners)
      if (approx.rows === 4 && area > bestArea) {
        bestArea = area
        bestContour = contour

        // Extract the 4 corner points
        const pts: Point[] = []
        for (let j = 0; j < 4; j++) {
          pts.push({
            x: approx.intAt(j, 0),
            y: approx.intAt(j, 1),
          })
        }

        // Sort: top-left, top-right, bottom-right, bottom-left
        const sorted = sortCorners(pts)
        bestCorners = sorted
      }

      approx.delete()
      approx = null
    }

    if (bestContour && bestArea > 0) {
      const confidence = Math.min(bestArea / (totalArea * 0.6), 1)
      return {
        detected: true,
        confidence,
        corners: bestCorners,
      }
    }

    return { detected: false, confidence: 0 }
  } catch {
    return { detected: false, confidence: 0 }
  } finally {
    src?.delete()
    gray?.delete()
    blurred?.delete()
    edges?.delete()
    contours?.delete()
    hierarchy?.delete()
    approx?.delete()
  }
}

/**
 * Sort 4 corner points into [top-left, top-right, bottom-right, bottom-left] order.
 */
function sortCorners(pts: Point[]): [Point, Point, Point, Point] {
  // Sort by y first (top/bottom), then by x (left/right)
  const sorted = [...pts].sort((a, b) => a.y - b.y)
  const topTwo = sorted.slice(0, 2).sort((a, b) => a.x - b.x)
  const bottomTwo = sorted.slice(2, 4).sort((a, b) => a.x - b.x)
  return [topTwo[0], topTwo[1], bottomTwo[1], bottomTwo[0]]
}
