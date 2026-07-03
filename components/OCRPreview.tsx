'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ExtractedFields, ScanRecord } from '@/lib/types'
import { appendRow } from '@/lib/googleSheets'
import { useSessionStore } from '@/lib/sessionStore'

interface OCRPreviewProps {
  initialFields: ExtractedFields
  recordId?: string // If editing an existing record
}

interface FieldValidation {
  email?: string
  phone?: string
  website?: string
}

function validateFields(fields: ExtractedFields): FieldValidation {
  const errors: FieldValidation = {}
  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = 'Looks like an unusual email format'
  }
  if (fields.phone && fields.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Phone number seems too short'
  }
  if (fields.website && fields.website !== '' && !/^https?:\/\/.+\..+/.test(fields.website)) {
    errors.website = 'Website URL looks unusual'
  }
  return errors
}

export function OCRPreview({ initialFields, recordId }: OCRPreviewProps) {
  const router = useRouter()
  const { addRecord, updateRecord, settings, records } = useSessionStore()

  const [fields, setFields] = useState<ExtractedFields>(initialFields)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showRaw, setShowRaw] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const validation = validateFields(fields)

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

    // Attempt Google Sheets sync
    if (settings.sheetsEndpoint) {
      const result = await appendRow(fields, settings.sheetsEndpoint, timestamp)
      if (result.success) {
        updateRecord(record.id, { syncStatus: 'saved', sheetRowNumber: result.rowNumber })
        // Haptic feedback
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([50, 30, 50])
        }
        showToast('Saved to Google Sheets ✓')
      } else {
        updateRecord(record.id, { syncStatus: 'failed' })
        setSaveError(`Saved locally. Sheets sync failed: ${result.error}`)
      }
    } else {
      updateRecord(record.id, { syncStatus: 'pending' })
      showToast('Saved locally (no Sheets endpoint configured)')
    }

    setSaving(false)

    // Navigate back to scanner for next brochure (fast loop)
    setTimeout(() => router.push('/scanner'), 800)
  }

  const handleRescan = () => {
    router.push('/scanner')
  }

  const FIELD_ROWS: { key: keyof ExtractedFields; label: string; type?: string; placeholder: string }[] = [
    { key: 'companyName', label: 'Company Name', placeholder: 'Company or organisation name' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'contact@example.com' },
    { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 800 555 1234' },
    { key: 'website', label: 'Website', type: 'url', placeholder: 'https://example.com' },
    { key: 'qrLink', label: 'QR Link', placeholder: 'Decoded QR content' },
    { key: 'address', label: 'Address', placeholder: '123 Main St, City, State 12345' },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-white">
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
            aria-label="Save record to Google Sheets"
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

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full pb-8">
        <div className="space-y-4">
          {FIELD_ROWS.map(({ key, label, type, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5 uppercase tracking-wider">
                {label}
              </label>
              <input
                type={type ?? 'text'}
                value={fields[key]}
                onChange={e => updateField(key, e.target.value)}
                placeholder={placeholder}
                className={`w-full rounded-xl bg-neutral-900 border px-4 py-3 text-sm text-white placeholder:text-neutral-700 outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all ${
                  validation[key as keyof FieldValidation]
                    ? 'border-amber-500/50'
                    : 'border-neutral-800 focus:border-cyan-500/50'
                }`}
              />
              {validation[key as keyof FieldValidation] && (
                <p className="mt-1 text-xs text-amber-400/80">
                  {validation[key as keyof FieldValidation]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Raw OCR Text panel */}
        <div className="mt-6">
          <button
            onClick={() => setShowRaw(v => !v)}
            className="flex items-center gap-2 text-xs font-medium text-neutral-500 uppercase tracking-wider w-full text-left py-2"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showRaw ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            Raw OCR Text
            <span className="text-neutral-700 normal-case tracking-normal font-normal">
              ({fields.rawText.trim().split(/\s+/).length} words)
            </span>
          </button>
          {showRaw && (
            <textarea
              value={fields.rawText}
              onChange={e => updateField('rawText', e.target.value)}
              rows={8}
              className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 text-xs text-neutral-400 font-mono outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all resize-none"
              placeholder="Raw OCR text will appear here…"
            />
          )}
        </div>
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
