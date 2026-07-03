'use client'

/**
 * Session-scoped in-memory store using Zustand.
 *
 * IMPORTANT: This store stores TEXT ONLY — no images, no binary data.
 * The session record list is also backed to sessionStorage (text only)
 * so it survives soft navigations but is cleared on hard refresh.
 */

import { create } from 'zustand'
import type { ScanRecord, ExtractedFields, AppSettings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/lib/types'

const SESSION_RECORDS_KEY = 'expo_ocr_session_records'

function loadSessionRecords(): ScanRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(SESSION_RECORDS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ScanRecord[]
  } catch {
    return []
  }
}

function saveSessionRecords(records: ScanRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_RECORDS_KEY, JSON.stringify(records))
  } catch {
    // sessionStorage may be full or unavailable — silently ignore
  }
}

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem('expo_ocr_settings')
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: AppSettings): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('expo_ocr_settings', JSON.stringify(settings))
  } catch {}
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── Store definition ─────────────────────────────────────────────────────────

interface SessionStore {
  // Current scan result — shared between scanner → preview
  currentScan: ExtractedFields | null
  setCurrentScan: (scan: ExtractedFields | null) => void

  // Session record list
  records: ScanRecord[]
  addRecord: (fields: ExtractedFields) => ScanRecord
  updateRecord: (id: string, updates: Partial<ScanRecord>) => void
  deleteRecord: (id: string) => void
  clearAllRecords: () => void
  retryRecord: (id: string) => void

  // Settings
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  currentScan: null,
  setCurrentScan: (scan) => set({ currentScan: scan }),

  records: loadSessionRecords(),

  addRecord: (fields) => {
    const record: ScanRecord = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      fields,
      syncStatus: 'pending',
    }
    set(state => {
      const records = [record, ...state.records]
      saveSessionRecords(records)
      return { records }
    })
    return record
  },

  updateRecord: (id, updates) => {
    set(state => {
      const records = state.records.map(r =>
        r.id === id ? { ...r, ...updates } : r
      )
      saveSessionRecords(records)
      return { records }
    })
  },

  deleteRecord: (id) => {
    set(state => {
      const records = state.records.filter(r => r.id !== id)
      saveSessionRecords(records)
      return { records }
    })
  },

  clearAllRecords: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_RECORDS_KEY)
    }
    set({ records: [] })
  },

  retryRecord: (id) => {
    get().updateRecord(id, { syncStatus: 'pending' })
  },

  settings: loadSettings(),

  updateSettings: (updates) => {
    set(state => {
      const settings = { ...state.settings, ...updates }
      saveSettings(settings)
      return { settings }
    })
  },
}))
