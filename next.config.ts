import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Camera permissions policy
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=self, microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },

  // Turbopack config (default bundler in Next.js 16)
  // Node.js built-in modules (fs, path, crypto) are automatically
  // excluded from the browser bundle by Turbopack — no manual fallbacks needed.
  turbopack: {},
}

export default nextConfig
