'use client'

import type { DetectionStatus } from '@/lib/types'

interface StatusIndicatorProps {
  status: DetectionStatus
  className?: string
}

interface PillProps {
  passing: boolean
  passingText: string
  failText: string
  pulsing?: boolean
}

function StatusPill({ passing, passingText, failText, pulsing }: PillProps) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md border transition-all duration-300 ${
        passing
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          : pulsing
          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 animate-pulse'
          : 'bg-neutral-800/50 border-neutral-700/30 text-neutral-500'
      }`}
    >
      {/* Status dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          passing ? 'bg-emerald-400' : pulsing ? 'bg-amber-400' : 'bg-neutral-600'
        }`}
      />
      <span>{passing ? passingText : failText}</span>
    </div>
  )
}

export function StatusIndicator({ status, className = '' }: StatusIndicatorProps) {
  const { document: doc, stability, blur } = status

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Document detection */}
      <StatusPill
        passing={doc.detected}
        passingText="✓ Document detected"
        failText="No document detected"
      />

      {/* Stability */}
      <StatusPill
        passing={stability.stable}
        passingText="✓ Stable"
        failText="Hold steady…"
        pulsing={!stability.stable}
      />

      {/* Sharpness — always shown now so users can manual-crop and scan */}
      <StatusPill
        passing={blur.sharp}
        passingText="✓ Sharp"
        failText={blur.score < 20 ? 'Image blurry — move closer' : 'Image blurry'}
        pulsing={!blur.sharp}
      />
    </div>
  )
}
