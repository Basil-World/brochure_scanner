'use client'

import Script from 'next/script'

/**
 * Client component wrapper for loading OpenCV.js via a script tag.
 * Needed because the onLoad event handler cannot be serialized
 * in a Server Component.
 */
export function OpenCVLoader() {
  return (
    <Script
      src="https://docs.opencv.org/4.x/opencv.js"
      strategy="lazyOnload"
      onLoad={() => {
        const w = window as unknown as Record<string, unknown>
        if (w.cv) {
          const cvObj = w.cv as { onRuntimeInitialized?: () => void }
          const dispatch = () => window.dispatchEvent(new CustomEvent('opencv-ready'))
          if (typeof cvObj.onRuntimeInitialized !== 'undefined') {
            cvObj.onRuntimeInitialized = dispatch
          } else {
            dispatch()
          }
        }
      }}
    />
  )
}
