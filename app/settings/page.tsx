'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSessionStore } from '@/lib/sessionStore'
import { testConnection } from '@/lib/googleSheets'
import { CROP_PRESETS } from '@/lib/types'
import type { AppSettings } from '@/lib/types'

const BLUR_MIN = 20
const BLUR_MAX = 500
const STABILITY_MIN = 500
const STABILITY_MAX = 3000

export default function SettingsPage() {
  const { settings, updateSettings, clearAllRecords, records } = useSessionStore()
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showClear, setShowClear] = useState(false)

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    updateSettings({ [key]: value })
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection(settings.sheetsEndpoint)
    setTestResult(result)
    setTesting(false)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800/50 px-4 pt-safe">
        <div className="flex items-center py-3 max-w-lg mx-auto">
          <Link href="/scanner" className="text-sm text-neutral-400 active:text-white px-2 py-1.5 -ml-2 flex items-center gap-1.5 mr-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Done
          </Link>
          <h1 className="text-base font-semibold absolute left-0 right-0 text-center pointer-events-none">Settings</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full space-y-8">

        {/* ── Google Sheets ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Google Sheets Integration</h2>

          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 divide-y divide-neutral-800 overflow-hidden">
            <div className="p-4">
              <label className="block text-sm font-medium text-neutral-300 mb-2">Apps Script Web App URL</label>
              <input
                type="url"
                value={settings.sheetsEndpoint}
                onChange={e => update('sheetsEndpoint', e.target.value)}
                placeholder="https://script.google.com/macros/s/…/exec"
                className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/50 transition-all"
              />
              <p className="mt-2 text-xs text-neutral-600">
                Paste the URL from your deployed Google Apps Script Web App.{' '}
                <span className="text-amber-500/80">Note: this endpoint is deployed as &quot;Anyone&quot; access — do not include sensitive data in sheet names or tab titles.</span>
              </p>
            </div>

            <div className="p-4 flex items-center justify-between">
              <div>
                {testResult && (
                  <p className={`text-xs ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
              <button
                onClick={handleTestConnection}
                disabled={testing || !settings.sheetsEndpoint}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  testing || !settings.sheetsEndpoint
                    ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                    : 'bg-neutral-800 text-neutral-200 border border-neutral-700 hover:border-cyan-500/40'
                }`}
              >
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Crop Presets ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Crop Box Preset</h2>
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden">
            {(Object.entries(CROP_PRESETS) as [AppSettings['cropPreset'], { label: string }][]).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => update('cropPreset', key)}
                className={`w-full flex items-center justify-between px-4 py-3 border-b border-neutral-800 last:border-0 transition-colors ${
                  settings.cropPreset === key ? 'text-cyan-400' : 'text-neutral-300 active:bg-neutral-800'
                }`}
              >
                <span className="text-sm">{preset.label}</span>
                {settings.cropPreset === key && (
                  <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* ── Detection Sensitivity ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Detection Sensitivity</h2>
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden divide-y divide-neutral-800">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-neutral-300">Sharpness Threshold</label>
                <span className="text-xs text-neutral-500 tabular-nums">{settings.blurThreshold}</span>
              </div>
              <input
                type="range"
                min={BLUR_MIN}
                max={BLUR_MAX}
                value={settings.blurThreshold}
                onChange={e => update('blurThreshold', Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <p className="text-xs text-neutral-600 mt-1">Higher = stricter sharpness requirement</p>
            </div>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-neutral-300">Stability Window</label>
                <span className="text-xs text-neutral-500 tabular-nums">{settings.stabilityWindow}ms</span>
              </div>
              <input
                type="range"
                min={STABILITY_MIN}
                max={STABILITY_MAX}
                step={100}
                value={settings.stabilityWindow}
                onChange={e => update('stabilityWindow', Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <p className="text-xs text-neutral-600 mt-1">Time the camera must be still before Read enables</p>
            </div>
          </div>
        </section>

        {/* ── Session Data ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Session Data</h2>
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 p-4">
            <p className="text-sm text-neutral-400 mb-3">
              {records.length} record{records.length !== 1 ? 's' : ''} in current session.
              Session data is cleared on page refresh.
            </p>
            {showClear ? (
              <div className="flex gap-3">
                <button
                  onClick={() => { clearAllRecords(); setShowClear(false) }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium active:scale-95 transition-transform"
                >
                  Confirm Clear
                </button>
                <button
                  onClick={() => setShowClear(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-800 text-neutral-400 text-sm active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClear(true)}
                disabled={records.length === 0}
                className="w-full py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-neutral-400 disabled:opacity-40 active:bg-neutral-700 transition-colors"
              >
                Clear Session Data
              </button>
            )}
          </div>
        </section>

        {/* ── About ─────────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">About</h2>
          <div className="rounded-2xl bg-neutral-900 border border-neutral-800 px-4 py-4 space-y-1">
            <p className="text-sm font-medium text-neutral-200">Expo OCR Scanner</p>
            <p className="text-xs text-neutral-500">v1.0.0 — Privacy-first brochure scanning</p>
            <p className="text-xs text-neutral-600 mt-2">
              No images are stored. Only extracted text is persisted. QR codes are decoded but never fetched.
            </p>
          </div>
        </section>

      </div>
    </div>
  )
}
