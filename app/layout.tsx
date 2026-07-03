import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { OpenCVLoader } from '@/components/OpenCVLoader'
import './globals.css'

export const metadata: Metadata = {
  title: 'Expo OCR Scanner',
  description: 'Scan brochures at trade shows — extract contacts instantly to Google Sheets. Zero image storage, privacy-first.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OCR Scanner',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-neutral-950 text-white antialiased overflow-hidden h-screen w-screen">
        <ServiceWorkerRegistration />
        {children}
        {/*
          OpenCV.js — loaded lazily after page paint via client component.
          The onLoad handler is wrapped in a 'use client' component (OpenCVLoader)
          because event handlers cannot be passed to Script in Server Components.
          ~8MB WASM, cached by service worker after first load.
        */}
        <OpenCVLoader />
      </body>
    </html>
  )
}
