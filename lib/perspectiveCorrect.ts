import type { Point, CropBox } from '@/lib/types'

// Declare the global cv object (loaded via CDN script tag)
declare const cv: {
  matFromImageData: (imageData: ImageData) => CvMat
  cvtColor: (src: CvMat, dst: CvMat, code: number) => void
  getPerspectiveTransform: (src: CvMat, dst: CvMat) => CvMat
  warpPerspective: (src: CvMat, dst: CvMat, M: CvMat, dsize: CvSize, flags: number, borderMode: number, borderValue: CvScalar) => void
  imshow: (canvas: HTMLCanvasElement | OffscreenCanvas, mat: CvMat) => void
  matFromArray: (rows: number, cols: number, type: number, array: number[]) => CvMat
  Mat: new () => CvMat
  Size: new (w: number, h: number) => CvSize
  Scalar: new (v0?: number, v1?: number, v2?: number, v3?: number) => CvScalar
  COLOR_RGBA2RGB: number
  INTER_LINEAR: number
  BORDER_CONSTANT: number
  CV_32FC2: number
}

interface CvMat {
  delete: () => void
  rows: number
  cols: number
}

interface CvSize {}
interface CvScalar {}

function isCvAvailable(): boolean {
  return typeof cv !== 'undefined' && cv != null
}

/**
 * Apply perspective correction to a cropped ImageData using four corner points.
 * If OpenCV is unavailable or corners are invalid, returns the plain crop as-is.
 *
 * @param imageData The cropped ROI image data
 * @param corners   [top-left, top-right, bottom-right, bottom-left] in image coords
 * @param outputWidth  Desired output width (defaults to imageData.width)
 * @param outputHeight Desired output height (defaults to imageData.height)
 */
export function applyPerspectiveCorrection(
  imageData: ImageData,
  corners: [Point, Point, Point, Point],
  outputWidth?: number,
  outputHeight?: number
): ImageData {
  if (!isCvAvailable()) {
    return imageData
  }

  const W = outputWidth ?? imageData.width
  const H = outputHeight ?? imageData.height

  // Validate corners are within image bounds
  const maxX = imageData.width
  const maxY = imageData.height
  const valid = corners.every(
    p => p.x >= 0 && p.x <= maxX && p.y >= 0 && p.y <= maxY
  )
  if (!valid || corners.length !== 4) {
    return imageData
  }

  let src: CvMat | null = null
  let dst: CvMat | null = null
  let M: CvMat | null = null
  let srcTri: CvMat | null = null
  let dstTri: CvMat | null = null
  let outputCanvas: OffscreenCanvas | null = null

  try {
    src = cv.matFromImageData(imageData)

    // Source points: detected corners [TL, TR, BR, BL]
    const [tl, tr, br, bl] = corners
    srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x, tl.y,
      tr.x, tr.y,
      br.x, br.y,
      bl.x, bl.y,
    ])

    // Destination points: perfectly rectangular
    dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      W, 0,
      W, H,
      0, H,
    ])

    M = cv.getPerspectiveTransform(srcTri, dstTri)
    dst = new cv.Mat()

    cv.warpPerspective(
      src,
      dst,
      M,
      new cv.Size(W, H),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar()
    )

    // Read result to ImageData via OffscreenCanvas
    outputCanvas = new OffscreenCanvas(W, H)
    cv.imshow(outputCanvas as unknown as HTMLCanvasElement, dst)
    const ctx = outputCanvas.getContext('2d')!
    return ctx.getImageData(0, 0, W, H)
  } catch {
    // Perspective correction failed — return plain crop
    return imageData
  } finally {
    src?.delete()
    dst?.delete()
    M?.delete()
    srcTri?.delete()
    dstTri?.delete()
  }
}

/**
 * Crop an ImageData to the given CropBox rectangle (in pixel coordinates of the imageData).
 */
export function cropImageData(imageData: ImageData, cropBox: CropBox): ImageData {
  const { x, y, width, height } = cropBox

  // Clamp to image bounds
  const sx = Math.max(0, Math.round(x))
  const sy = Math.max(0, Math.round(y))
  const sw = Math.min(Math.round(width), imageData.width - sx)
  const sh = Math.min(Math.round(height), imageData.height - sy)

  if (sw <= 0 || sh <= 0) return imageData

  try {
    const offscreen = new OffscreenCanvas(sw, sh)
    const ctx = offscreen.getContext('2d')!
    const srcCanvas = new OffscreenCanvas(imageData.width, imageData.height)
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.putImageData(imageData, 0, 0)
    ctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh)
    return ctx.getImageData(0, 0, sw, sh)
  } catch {
    return imageData
  }
}

/**
 * Map a crop box from display/overlay space to actual video resolution space.
 *
 * @param displayCropBox   CropBox in CSS/display pixel coords
 * @param displayWidth     Displayed video element width
 * @param displayHeight    Displayed video element height
 * @param videoWidth       Actual video stream width
 * @param videoHeight      Actual video stream height
 */
export function mapCropBoxToVideoSpace(
  displayCropBox: CropBox,
  displayWidth: number,
  displayHeight: number,
  videoWidth: number,
  videoHeight: number
): CropBox {
  const scaleX = videoWidth / displayWidth
  const scaleY = videoHeight / displayHeight
  return {
    x: displayCropBox.x * scaleX,
    y: displayCropBox.y * scaleY,
    width: displayCropBox.width * scaleX,
    height: displayCropBox.height * scaleY,
  }
}
