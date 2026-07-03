'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { CameraPermission } from '@/lib/types'

interface UseCameraOptions {
  preferredDeviceId?: string
}

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>
  stream: MediaStream | null
  permission: CameraPermission
  error: string | null
  devices: MediaDeviceInfo[]
  activeDeviceId: string | null
  isRearCamera: boolean
  retryPermission: () => void
  switchCamera: (deviceId: string) => Promise<void>
  stopCamera: () => void
  startCamera: (deviceId?: string) => Promise<void>
}

export function useCamera({ preferredDeviceId }: UseCameraOptions = {}): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [permission, setPermission] = useState<CameraPermission>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)
  const [isRearCamera, setIsRearCamera] = useState(false)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
      setStream(null)
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startCamera = useCallback(async (deviceId?: string) => {
    stopCamera()
    setPermission('requesting')
    setError(null)

    // Use simple constraints first. 
    // Requesting landscape resolutions (1920x1080) on portrait mobile devices causes the camera driver to hang for 3-5 seconds.
    const constraintsList: MediaStreamConstraints[] = deviceId
      ? [
          { video: { deviceId: { exact: deviceId } } },
          { video: true }
        ]
      : [
          { video: { facingMode: { ideal: 'environment' } } },
          { video: true }
        ]

    let mediaStream: MediaStream | null = null
    let lastError: DOMException | null = null

    for (const constraints of constraintsList) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
        break // Success!
      } catch (err) {
        lastError = err as DOMException
        console.warn('Failed to get camera with constraints:', constraints, lastError)
      }
    }

    if (!mediaStream) {
      if (lastError) {
        if (lastError.name === 'NotAllowedError' || lastError.name === 'PermissionDeniedError') {
          setPermission('denied')
          setError('Camera permission denied. Please enable camera access in your browser settings and reload the page.')
        } else if (lastError.name === 'NotFoundError' || lastError.name === 'DevicesNotFoundError') {
          setPermission('unavailable')
          setError('No camera found on this device.')
        } else {
          setPermission('unavailable')
          setError(`Camera error: ${lastError.message}`)
        }
      }
      return
    }

    try {
      streamRef.current = mediaStream
      setStream(mediaStream)
      setPermission('granted')

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play().catch(() => {
          // autoplay may be blocked, handled by playsInline + muted
        })
      }

      // Detect if rear camera
      const videoTrack = mediaStream.getVideoTracks()[0]
      const settings = videoTrack?.getSettings()
      setActiveDeviceId(settings?.deviceId ?? deviceId ?? null)
      setIsRearCamera(settings?.facingMode === 'environment')

      // Enumerate devices now that we have permission
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput')
      setDevices(videoDevices)
    } catch (err) {
      setPermission('unavailable')
      setError(`Camera playback error: ${(err as Error).message}`)
    }
  }, [stopCamera])

  const retryPermission = useCallback(() => {
    startCamera(preferredDeviceId)
  }, [startCamera, preferredDeviceId])

  const switchCamera = useCallback(async (deviceId: string) => {
    await startCamera(deviceId)
  }, [startCamera])

  // Initial camera start
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unavailable')
      setError('Camera API is not available in this browser.')
      return
    }
    startCamera(preferredDeviceId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle tab visibility changes — stop camera when tab hidden, resume when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera()
      } else {
        // Re-acquire camera when tab becomes visible again
        startCamera(activeDeviceId ?? preferredDeviceId)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeviceId])

  // Keep video element in sync when stream changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  return {
    videoRef,
    stream,
    permission,
    error,
    devices,
    activeDeviceId,
    isRearCamera,
    retryPermission,
    switchCamera,
    stopCamera,
    startCamera,
  }
}
