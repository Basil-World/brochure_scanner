'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { CropBox } from '@/lib/types'

interface CropOverlayProps {
  cropBox: CropBox
  onChange: (box: CropBox) => void
  onReset: () => void
  containerWidth: number
  containerHeight: number
  disabled?: boolean
}

const MIN_SIZE = 80
const HANDLE_SIZE = 44 // minimum touch target

export function CropOverlay({
  cropBox,
  onChange,
  onReset,
  containerWidth,
  containerHeight,
  disabled = false,
}: CropOverlayProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null) // handle id
  const dragStartRef = useRef<{ x: number; y: number; box: CropBox } | null>(null)

  const clampBox = useCallback((box: CropBox): CropBox => {
    const x = Math.max(0, Math.min(box.x, containerWidth - box.width))
    const y = Math.max(0, Math.min(box.y, containerHeight - box.height))
    const width = Math.max(MIN_SIZE, Math.min(box.width, containerWidth))
    const height = Math.max(MIN_SIZE, Math.min(box.height, containerHeight))
    return { x, y, width, height }
  }, [containerWidth, containerHeight])

  // ── Pointer event helpers ─────────────────────────────────────────────────

  const getClientXY = (e: React.PointerEvent | PointerEvent) => ({ x: e.clientX, y: e.clientY })

  // Drag the whole box
  const onBoxPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled || isResizing) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, box: { ...cropBox } }
  }, [disabled, isResizing, cropBox])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    const start = dragStartRef.current.box

    if (isDragging) {
      onChange(clampBox({ ...start, x: start.x + dx, y: start.y + dy }))
    } else if (isResizing) {
      const handle = isResizing
      let { x, y, width, height } = start

      if (handle.includes('right')) width = Math.max(MIN_SIZE, start.width + dx)
      if (handle.includes('left')) { x = start.x + dx; width = Math.max(MIN_SIZE, start.width - dx) }
      if (handle.includes('bottom')) height = Math.max(MIN_SIZE, start.height + dy)
      if (handle.includes('top')) { y = start.y + dy; height = Math.max(MIN_SIZE, start.height - dy) }

      onChange(clampBox({ x, y, width, height }))
    }
  }, [isDragging, isResizing, onChange, clampBox])

  const onPointerUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(null)
    dragStartRef.current = null
  }, [])

  // Handle resize handles
  const onHandlePointerDown = useCallback((e: React.PointerEvent, handle: string) => {
    if (disabled) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsResizing(handle)
    dragStartRef.current = { x: e.clientX, y: e.clientY, box: { ...cropBox } }
  }, [disabled, cropBox])

  // ── Render ────────────────────────────────────────────────────────────────

  const { x, y, width, height } = cropBox
  const right = x + width
  const bottom = y + height
  const cx = x + width / 2
  const cy = y + height / 2

  // Corner handles
  const handles = [
    { id: 'top-left', cx: x, cy: y },
    { id: 'top-right', cx: right, cy: y },
    { id: 'bottom-left', cx: x, cy: bottom },
    { id: 'bottom-right', cx: right, cy: bottom },
  ]

  // Edge handles (midpoints)
  const edgeHandles = [
    { id: 'top', cx, cy: y },
    { id: 'bottom', cx, cy: bottom },
    { id: 'left', cx: x, cy },
    { id: 'right', cx: right, cy },
  ]

  if (containerWidth === 0 || containerHeight === 0) return null

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${containerWidth} ${containerHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ touchAction: 'none' }}
    >
      {/* Dark mask outside ROI */}
      <defs>
        <mask id="roi-mask">
          <rect width={containerWidth} height={containerHeight} fill="white" />
          <rect x={x} y={y} width={width} height={height} fill="black" rx="6" />
        </mask>
      </defs>
      <rect
        width={containerWidth}
        height={containerHeight}
        fill="rgba(0,0,0,0.55)"
        mask="url(#roi-mask)"
        className="pointer-events-none"
      />

      {/* ROI border */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        stroke="rgba(6,182,212,0.9)"
        strokeWidth={2}
        rx={6}
        className={`pointer-events-auto ${disabled ? 'cursor-default' : 'cursor-move'}`}
        onPointerDown={onBoxPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ pointerEvents: 'all' }}
      />

      {/* Corner rule lines */}
      {[
        // TL
        [x, y + 20, x, y, x + 20, y],
        // TR
        [right - 20, y, right, y, right, y + 20],
        // BL
        [x, bottom - 20, x, bottom, x + 20, bottom],
        // BR
        [right - 20, bottom, right, bottom, right, bottom - 20],
      ].map((pts, i) => (
        <polyline
          key={i}
          points={`${pts[0]},${pts[1]} ${pts[2]},${pts[3]} ${pts[4]},${pts[5]}`}
          fill="none"
          stroke="rgba(6,182,212,1)"
          strokeWidth={3}
          strokeLinecap="round"
          className="pointer-events-none"
        />
      ))}

      {/* Grid overlay (rule-of-thirds) */}
      {[1, 2].map(i => (
        <g key={i}>
          <line
            x1={x + (width / 3) * i} y1={y}
            x2={x + (width / 3) * i} y2={y + height}
            stroke="rgba(6,182,212,0.2)" strokeWidth={0.5}
            className="pointer-events-none"
          />
          <line
            x1={x} y1={y + (height / 3) * i}
            x2={x + width} y2={y + (height / 3) * i}
            stroke="rgba(6,182,212,0.2)" strokeWidth={0.5}
            className="pointer-events-none"
          />
        </g>
      ))}

      {/* Corner resize handles */}
      {!disabled && handles.map(h => (
        <rect
          key={h.id}
          x={h.cx - HANDLE_SIZE / 2}
          y={h.cy - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="transparent"
          className="pointer-events-auto cursor-pointer"
          onPointerDown={e => onHandlePointerDown(e, h.id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ pointerEvents: 'all' }}
        />
      ))}

      {/* Edge resize handles */}
      {!disabled && edgeHandles.map(h => (
        <rect
          key={h.id}
          x={h.cx - HANDLE_SIZE / 2}
          y={h.cy - HANDLE_SIZE / 2}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="transparent"
          className="pointer-events-auto cursor-pointer"
          onPointerDown={e => onHandlePointerDown(e, h.id)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ pointerEvents: 'all' }}
        />
      ))}

      {/* Reset button — top-right of crop box */}
      {!disabled && (
        <foreignObject x={right - 70} y={y - 36} width={70} height={32}>
          <button
            onClick={onReset}
            className="w-full h-full rounded-lg bg-neutral-800/80 backdrop-blur-sm border border-neutral-700/50 text-neutral-300 text-xs font-medium active:scale-95 transition-transform"
            style={{ all: 'revert', cursor: 'pointer' }}
          >
            Reset
          </button>
        </foreignObject>
      )}
    </svg>
  )
}

/** Compute default crop box centered in a container with brochure aspect ratio */
export function defaultCropBox(containerWidth: number, containerHeight: number, aspectRatio = 0.707): CropBox {
  const w = Math.round(containerWidth * 0.85)
  const h = Math.round(w * aspectRatio)
  const safeH = Math.min(h, containerHeight * 0.80)
  const safeW = aspectRatio > 0 ? Math.round(safeH / aspectRatio) : w
  return {
    x: Math.round((containerWidth - safeW) / 2),
    y: Math.round((containerHeight - safeH) / 2),
    width: safeW,
    height: safeH,
  }
}
