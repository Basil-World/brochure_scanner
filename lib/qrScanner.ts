/**
 * ZXing-based QR code scanner.
 * Decode-only — the decoded string is never fetched, navigated to, or stored as a URL.
 */

/**
 * Decode a QR code from an ImageData.
 * Returns the decoded string, or null if no QR code was found.
 * This function is entirely decode-only — it never navigates or fetches.
 */
export async function decodeQR(imageData: ImageData): Promise<string | null> {
  try {
    const { BrowserQRCodeReader } = await import('@zxing/browser')
    const reader = new BrowserQRCodeReader()

    // Convert ImageData → ImageBitmap → draw onto a canvas element
    const bitmap = await createImageBitmap(imageData)
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    // Create an image element from the canvas for ZXing
    const dataUrl = canvas.toDataURL('image/png')
    const img = document.createElement('img')
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = dataUrl
    })

    const result = await reader.decodeFromImageElement(img)
    return result?.getText() ?? null
  } catch (err: unknown) {
    // NotFoundException is thrown when no QR code is found — this is expected
    // Only log unexpected errors
    const errStr = String(err)
    if (!errStr.includes('NotFoundException') && !errStr.includes('No MultiFormat')) {
      console.debug('[qrScanner] decode result:', errStr)
    }
    return null
  }
}
