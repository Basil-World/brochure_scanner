'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/lib/sessionStore'
import { OCRPreview } from '@/components/OCRPreview'
import { retryPendingRecords } from '@/lib/googleSheets'
import type { ScanRecord, ExtractedFields } from '@/lib/types'

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch {
    return iso
  }
}

function SyncBadge({ status }: { status: ScanRecord['syncStatus'] }) {
  const styles = {
    saved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  }
  const labels = { saved: '✓ Saved', pending: 'Pending', failed: '✗ Failed' }
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function exportCSV(records: ScanRecord[]) {
  const headers = ['Timestamp', 'Company Name', 'Email', 'Phone', 'Website', 'QR Link', 'Address', 'Raw OCR Text', 'Sync Status']
  const rows = records.map(r => [
    r.timestamp,
    r.fields.companyName,
    r.fields.email,
    r.fields.phone,
    r.fields.website,
    r.fields.qrLink,
    r.fields.address,
    r.fields.rawText.replace(/\n/g, ' '),
    r.syncStatus,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `expo-ocr-session-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function SavedPage() {
  const { records, updateRecord, deleteRecord, clearAllRecords, settings } = useSessionStore()
  const [viewRecord, setViewRecord] = useState<ScanRecord | null>(null)
  const [editRecord, setEditRecord] = useState<ScanRecord | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const pendingCount = records.filter(r => r.syncStatus !== 'saved').length

  const handleRetryAll = async () => {
    if (!settings.sheetsEndpoint) return
    setRetrying(true)
    const updated = await retryPendingRecords(records, settings.sheetsEndpoint)
    updated.forEach(r => updateRecord(r.id, r))
    setRetrying(false)
  }

  const handleClearAll = () => {
    clearAllRecords()
    setShowClearConfirm(false)
  }

  // Edit mode — reuse OCRPreview with existing record
  if (editRecord) {
    return (
      <OCRPreview
        initialFields={editRecord.fields}
        recordId={editRecord.id}
      />
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800/50 px-4 pt-safe">
        <div className="flex items-center justify-between py-3 max-w-lg mx-auto">
          <Link href="/scanner" className="text-sm text-neutral-400 active:text-white px-2 py-1.5 -ml-2 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Scanner
          </Link>
          <h1 className="text-base font-semibold">
            Saved Records
            {records.length > 0 && (
              <span className="ml-1.5 text-neutral-500 font-normal">({records.length})</span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            {records.length > 0 && (
              <button
                onClick={() => exportCSV(records)}
                className="text-xs text-cyan-400 active:text-cyan-300 px-2 py-1.5"
                aria-label="Export records as CSV"
              >
                Export
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session data notice */}
      <div className="mx-4 mt-3 max-w-lg mx-auto">
        <p className="text-xs text-neutral-600 text-center">
          Records are session-scoped and cleared on page refresh. Export CSV to keep them permanently.
        </p>
      </div>

      {/* Retry banner */}
      {pendingCount > 0 && settings.sheetsEndpoint && (
        <div className="mx-4 mt-3 max-w-lg">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-amber-300">
              {pendingCount} record{pendingCount > 1 ? 's' : ''} not synced
            </p>
            <button
              onClick={handleRetryAll}
              disabled={retrying}
              className="text-xs font-semibold text-amber-300 border border-amber-400/30 rounded-lg px-3 py-1.5 active:scale-95 transition-transform disabled:opacity-50"
            >
              {retrying ? 'Retrying…' : 'Retry All'}
            </button>
          </div>
        </div>
      )}

      {/* Record list */}
      <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <p className="text-neutral-500 text-sm mb-2">No records yet</p>
            <Link href="/scanner" className="text-cyan-400 text-sm">Start scanning →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {records.map(record => (
              <div
                key={record.id}
                className="rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden"
              >
                <div className="flex items-start justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-white truncate">
                      {record.fields.companyName || 'Untitled'}
                    </p>
                    {record.fields.email && (
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{record.fields.email}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-neutral-600">{formatTimestamp(record.timestamp)}</span>
                      <SyncBadge status={record.syncStatus} />
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => setViewRecord(record)}
                      className="p-2 rounded-lg text-neutral-400 active:text-white active:bg-neutral-800 transition-colors"
                      aria-label="View record"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditRecord(record)}
                      className="p-2 rounded-lg text-neutral-400 active:text-white active:bg-neutral-800 transition-colors"
                      aria-label="Edit record"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="p-2 rounded-lg text-neutral-400 active:text-red-400 active:bg-neutral-800 transition-colors"
                      aria-label="Delete record"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clear all */}
        {records.length > 0 && (
          <div className="mt-6 text-center">
            {showClearConfirm ? (
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleClearAll}
                  className="text-sm text-red-400 font-medium px-4 py-2 rounded-lg active:bg-neutral-900"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="text-sm text-neutral-500 px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-sm text-neutral-600 active:text-neutral-400 transition-colors py-2"
              >
                Clear All Records
              </button>
            )}
          </div>
        )}
      </div>

      {/* View modal */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 bg-neutral-950/95 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <h2 className="font-semibold text-base">{viewRecord.fields.companyName || 'Record Detail'}</h2>
            <button
              onClick={() => setViewRecord(null)}
              className="text-neutral-400 p-1.5 rounded-lg active:bg-neutral-800"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {[
              { label: 'Email', value: viewRecord.fields.email },
              { label: 'Phone', value: viewRecord.fields.phone },
              { label: 'Website', value: viewRecord.fields.website },
              { label: 'QR Link', value: viewRecord.fields.qrLink },
              { label: 'Address', value: viewRecord.fields.address },
            ].map(({ label, value }) => value ? (
              <div key={label}>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm text-white break-all">{value}</p>
              </div>
            ) : null)}
            {viewRecord.fields.rawText && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Raw OCR Text</p>
                <p className="text-xs text-neutral-400 font-mono whitespace-pre-wrap">{viewRecord.fields.rawText}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
