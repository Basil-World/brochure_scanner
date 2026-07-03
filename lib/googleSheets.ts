import type { ScanRecord, ExtractedFields } from '@/lib/types'

const SHEET_HEADERS = [
  'Timestamp',
  'Company Name',
  'Email',
  'Phone',
  'Website',
  'QR Link',
  'Address',
  'Raw OCR Text',
]

interface AppendRowResult {
  success: boolean
  rowNumber?: number
  error?: string
}

/**
 * Append a record row to the Google Sheet via the Apps Script Web App endpoint.
 * POSTs JSON — no image/binary data ever included.
 *
 * @param record    The extracted fields + metadata to save
 * @param endpoint  The Apps Script Web App URL from settings
 * @param timestamp ISO 8601 timestamp (generated client-side at save time)
 */
export async function appendRow(
  record: ExtractedFields,
  endpoint: string,
  timestamp: string
): Promise<AppendRowResult> {
  if (!endpoint) {
    return { success: false, error: 'No Google Sheets endpoint configured. Please set it in Settings.' }
  }

  const payload = {
    headers: SHEET_HEADERS,
    row: [
      timestamp,
      record.companyName,
      record.email,
      record.phone,
      record.website,
      record.qrLink,
      record.address,
      record.rawText,
    ],
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script Web Apps need text/plain to avoid CORS preflight
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText)
      return { success: false, error: `Server error ${response.status}: ${text}` }
    }

    const json = await response.json().catch(() => null)
    return {
      success: true,
      rowNumber: json?.row ?? undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Network error: ${message}` }
  }
}

/**
 * Test the Apps Script endpoint with a GET request (the script's doGet handler).
 */
export async function testConnection(endpoint: string): Promise<{ ok: boolean; message: string }> {
  if (!endpoint) {
    return { ok: false, message: 'No endpoint URL provided.' }
  }

  try {
    const response = await fetch(endpoint, { method: 'GET' })
    if (response.ok) {
      return { ok: true, message: 'Connection successful ✓' }
    }
    return { ok: false, message: `Endpoint returned status ${response.status}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `Connection failed: ${message}` }
  }
}

/**
 * Retry saving any pending/failed records.
 * Returns updated records with new sync statuses.
 */
export async function retryPendingRecords(
  records: ScanRecord[],
  endpoint: string
): Promise<ScanRecord[]> {
  return Promise.all(
    records.map(async record => {
      if (record.syncStatus !== 'pending' && record.syncStatus !== 'failed') {
        return record
      }
      const result = await appendRow(record.fields, endpoint, record.timestamp)
      return {
        ...record,
        syncStatus: result.success ? ('saved' as const) : ('failed' as const),
        sheetRowNumber: result.rowNumber,
      }
    })
  )
}
