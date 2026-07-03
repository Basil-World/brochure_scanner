'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ExtractedFields, ScanRecord } from '@/lib/types'
import { pushToSupabase } from '@/lib/supabase'
import { useSessionStore } from '@/lib/sessionStore'

interface OCRPreviewProps {
  initialFields: ExtractedFields
  recordId?: string // If editing an existing record
  onClose?: () => void
}

export function OCRPreview({ initialFields, recordId, onClose }: OCRPreviewProps) {
  const router = useRouter()
  const { addRecord, updateRecord, settings, records } = useSessionStore()

  const [fields, setFields] = useState<ExtractedFields>(initialFields)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const updateField = (key: keyof ExtractedFields, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)

    const timestamp = new Date().toISOString()

    // Append or add record to session store
    let record: ScanRecord
    if (recordId) {
      // Editing existing record — update in session
      updateRecord(recordId, { fields, syncStatus: 'pending' })
      record = { id: recordId, timestamp, fields, syncStatus: 'pending' }
    } else {
      record = addRecord(fields)
    }

    // Attempt Supabase sync
    const success = await pushToSupabase(record)
    if (success) {
      updateRecord(record.id, { syncStatus: 'saved' })
      // Haptic feedback
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([50, 30, 50])
      }
      showToast('Saved to Supabase ✓')
    } else {
      updateRecord(record.id, { syncStatus: 'failed' })
      setSaveError('Saved locally. Supabase sync failed. Check your connection or credentials.')
    }

    setSaving(false)

    // Navigate back to scanner for next brochure (fast loop)
    setTimeout(() => {
      if (onClose) onClose()
      else router.push('/scanner')
    }, 800)
  }

  const handleRescan = () => {
    if (onClose) onClose()
    else router.push('/scanner')
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800/50 px-4 pt-safe">
        <div className="flex items-center justify-between py-3 max-w-lg mx-auto">
          <button
            onClick={handleRescan}
            className="flex items-center gap-1.5 text-sm text-neutral-400 active:text-white transition-colors -ml-1 px-2 py-1.5"
            aria-label="Rescan brochure"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Rescan
          </button>
          <h1 className="text-base font-semibold">Review & Save</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all active:scale-95 ${
              saving
                ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed'
                : 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.3)]'
            }`}
            aria-label="Save record"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-300">
          {saveError}
        </div>
      )}

      {/* Raw OCR Text panel */}
      <div className="flex-1 flex flex-col px-4 py-4 max-w-lg mx-auto w-full pb-8">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
            Raw OCR Text
          </label>
          <span className="text-xs text-neutral-600 font-medium">
            {fields.rawText.trim().split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
        
        <textarea
          value={fields.rawText}
          onChange={e => updateField('rawText', e.target.value)}
          className="flex-1 w-full rounded-2xl bg-neutral-900 border border-neutral-800 p-5 text-sm text-neutral-300 font-mono outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all resize-none leading-relaxed"
          placeholder="Raw OCR text will appear here…"
        />
        
        <p className="text-xs text-neutral-600 mt-4 text-center">
          Edit any text errors here before saving. The AI backend will automatically extract names, emails, and phone numbers from this raw text later.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl px-5 py-3 text-sm text-white shadow-xl">
            {toast}
          </div>
        </div>
      )}
    </div>
  )
}
