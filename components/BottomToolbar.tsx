'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface BottomToolbarProps {
  onRead: () => void
  readDisabled: boolean
  readState?: 'idle' | 'processing'
  savedCount?: number
}

export function BottomToolbar({
  onRead,
  readDisabled,
  readState = 'idle',
  savedCount = 0,
}: BottomToolbarProps) {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 pb-safe">
      {/* Backdrop blur + gradient bottom bar */}
      <div className="bg-neutral-950/80 backdrop-blur-xl border-t border-neutral-800/50">
        <div className="flex items-center justify-around px-4 pt-3 pb-4 max-w-lg mx-auto">

          {/* Saved Records */}
          <Link
            href="/saved"
            className={`flex flex-col items-center gap-1 min-w-[64px] min-h-[44px] justify-center rounded-xl px-3 py-2 transition-colors ${
              pathname === '/saved'
                ? 'text-cyan-400'
                : 'text-neutral-500 active:text-neutral-300'
            }`}
            aria-label={`Saved records${savedCount > 0 ? `, ${savedCount} records` : ''}`}
          >
            <div className="relative">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              {savedCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-cyan-500 text-black text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                  {savedCount > 99 ? '99+' : savedCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">Records</span>
          </Link>

          {/* READ — center / primary action */}
          <button
            onClick={onRead}
            disabled={readDisabled || readState === 'processing'}
            aria-label="Scan brochure"
            aria-disabled={readDisabled}
            className={`
              relative flex flex-col items-center justify-center gap-1
              w-20 h-20 rounded-2xl font-bold text-sm transition-all duration-200
              ${readDisabled || readState === 'processing'
                ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-50 scale-100'
                : 'bg-gradient-to-br from-cyan-400 to-cyan-600 text-black shadow-[0_0_24px_rgba(6,182,212,0.4)] active:scale-95 hover:shadow-[0_0_32px_rgba(6,182,212,0.6)]'
              }
            `}
          >
            {readState === 'processing' ? (
              <div className="w-6 h-6 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75V16.5ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
              </svg>
            )}
            <span className="text-[11px]">
              {readState === 'processing' ? 'Reading…' : 'READ'}
            </span>
          </button>

          {/* Settings */}
          <Link
            href="/settings"
            className={`flex flex-col items-center gap-1 min-w-[64px] min-h-[44px] justify-center rounded-xl px-3 py-2 transition-colors ${
              pathname === '/settings'
                ? 'text-cyan-400'
                : 'text-neutral-500 active:text-neutral-300'
            }`}
            aria-label="Settings"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span className="text-[10px] font-medium">Settings</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
