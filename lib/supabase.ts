import { createClient } from '@supabase/supabase-js'
import type { ScanRecord } from './types'

// These must be provided in Vercel environment variables or .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create client lazily or handle empty gracefully to allow Next.js static build to succeed
export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

/**
 * Pushes a scan record to the Supabase database.
 * Returns true if successful, false otherwise.
 */
export async function pushToSupabase(record: ScanRecord): Promise<boolean> {
  if (!supabaseUrl || !supabaseKey || !supabase) {
    console.error('Supabase credentials are not configured.')
    return false
  }

  try {
    const { error } = await supabase
      .from('scans')
      .insert([
        {
          id: record.id,
          // Convert local ISO string to standard timestamp if needed, or let Supabase use it
          created_at: record.timestamp,
          company_name: record.fields.companyName || null,
          email: record.fields.email || null,
          phone: record.fields.phone || null,
          website: record.fields.website || null,
          qr_link: record.fields.qrLink || null,
          address: record.fields.address || null,
          raw_text: record.fields.rawText || null,
        }
      ])

    if (error) {
      console.error('Supabase insert error:', error.message)
      return false
    }

    return true
  } catch (error) {
    console.error('Error pushing to Supabase:', error)
    return false
  }
}

/**
 * Retries a list of pending records.
 * Returns the list of records with updated sync statuses.
 */
export async function retryPendingRecordsSupabase(records: ScanRecord[]): Promise<ScanRecord[]> {
  const pendingRecords = records.filter(r => r.syncStatus !== 'saved')
  if (pendingRecords.length === 0) return []

  const updatedRecords: ScanRecord[] = []

  for (const record of pendingRecords) {
    const success = await pushToSupabase(record)
    updatedRecords.push({
      ...record,
      syncStatus: success ? 'saved' : 'failed'
    })
  }

  return updatedRecords
}
