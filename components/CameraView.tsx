'use client'

import { useEffect } from 'react'
import type { CameraPermission } from '@/lib/types'

interface CameraViewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  permission: CameraPermission
  error: string | null
  isRearCamera: boolean
  isMirrored: boolean
  onRetry: () => void
  className?: string
}

export function CameraView({
  videoRef,
  permission,
  error,
  isRearCamera,
  isMirrored,
  onRetry,
  className = '',
}: CameraViewProps) {
  // Ensure video plays when mounted
  useEffect(() => {
    const video = videoRef.current
    if (video && video.srcObject) {
      video.play().catch(() => {})
    }
  }, [videoRef])

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden ${className}`}>
      {/* Live camera feed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
        aria-label="Camera viewfinder"
      />

      {/* Permission denied state */}
      {permission === 'denied' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/95 px-8 text-center z-20">
          <div className="mb-6 w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9l-6 6M12 9l6 6" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Camera Access Required</h2>
          <p className="text-sm text-neutral-400 mb-2">
            {error ?? 'Camera permission was denied.'}
          </p>
          <p className="text-xs text-neutral-500 mb-6">
            To enable: tap the lock icon in your browser&apos;s address bar → Camera → Allow.
          </p>
          <button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-cyan-500 text-black font-semibold text-sm active:scale-95 transition-transform"
            aria-label="Retry camera permission"
          >
            Try Again
          </button>
        </div>
      )}

      {/* No camera / unavailable */}
      {permission === 'unavailable' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/95 px-8 text-center z-20">
          <div className="mb-6 w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No Camera Available</h2>
          <p className="text-sm text-neutral-400 mb-6">{error ?? 'No camera detected.'}</p>
          <button
            onClick={onRetry}
            className="px-6 py-3 rounded-xl bg-cyan-500 text-black font-semibold text-sm active:scale-95 transition-transform"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading/requesting */}
      {(permission === 'unknown' || permission === 'requesting') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-20">
          <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-neutral-400">Accessing camera&hellip;</p>
        </div>
      )}

      {/* Non-rear camera warning banner */}
      {permission === 'granted' && !isRearCamera && (
        <div className="absolute top-4 left-4 right-4 z-10">
          <div className="rounded-lg bg-amber-500/20 backdrop-blur-sm border border-amber-500/30 px-3 py-2 text-xs text-amber-300 text-center">
            ⚠ Using front camera — rear camera not detected
          </div>
        </div>
      )}
    </div>
  )
}
