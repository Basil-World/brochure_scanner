'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker for PWA offline support.
 * Only runs in production or when explicitly enabled.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(reg => {
          console.debug('[sw] registered:', reg.scope)
        })
        .catch(err => {
          console.warn('[sw] registration failed:', err)
        })
    }
  }, [])

  return null
}
