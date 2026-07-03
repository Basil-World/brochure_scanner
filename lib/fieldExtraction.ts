import type { ExtractedFields } from '@/lib/types'

// ─── Regex patterns ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// International phone numbers: +1-800-555-1234, (555) 123-4567, 555.123.4567, etc.
const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s\-.])?(?:\(?\d{1,4}\)?[\s\-.])\d{1,4}[\s\-.]?\d{1,4}[\s\-.]?\d{1,9}(?:\s*(?:#|x|ext\.?)\s*\d{1,4})?/g

// URL-like tokens
const URL_REGEX =
  /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9\-]+(?:\.[a-zA-Z]{2,})+(?:\/[^\s,;:"'<>()[\]{}|\\^`]*)?/g

// Street address patterns
const ADDRESS_REGEX =
  /\d{1,5}[\s\w]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Plaza|Pl|Square|Sq|Place|Terrace|Ter|Circle|Cir)[,.\s]*(?:[A-Z]{2}\s*)?\d{5}(?:-\d{4})?/gi

// Postal code patterns for non-US (UK, CA, AU etc)
const POSTAL_REGEX = /[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|\d{5,6}(?:-\d{4})?/g

// ─── Helper functions ─────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  let url = raw.trim().replace(/[.,;:'"()[\]{}\\]+$/, '')
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  return url
}

function isLikelyEmail(s: string): boolean {
  return EMAIL_REGEX.test(s)
}

function isLikelyUrl(s: string): boolean {
  return URL_REGEX.test(s) && s.includes('.')
}

/** Estimate phone likelihood: longer = more likely, purely numeric sequences docked */
function phoneScore(phone: string): number {
  const digits = phone.replace(/\D/g, '').length
  // Prefer 10–13 digit phones
  if (digits < 7 || digits > 15) return 0
  return digits
}

/**
 * Heuristically pick the company name from the first prominent lines of OCR text.
 * Strategy: take the longest single word/phrase from the first 3 non-empty lines.
 */
function extractCompanyName(lines: string[]): string {
  const candidates = lines
    .slice(0, 5)
    .map(l => l.trim())
    .filter(l => l.length > 1 && l.length < 80)
    // Exclude lines that look like emails, phones, or URLs
    .filter(l => !EMAIL_REGEX.test(l) && !URL_REGEX.test(l))

  // Return the first substantial candidate
  return candidates[0] ?? ''
}

// ─── Main extractor ───────────────────────────────────────────────────────────

/**
 * Extract structured contact fields from raw OCR text.
 * This is a pure function — no side effects.
 * Designed so that a Gemini API call can be inserted between this and the Preview screen.
 *
 * @param rawText  Raw text output from Tesseract.js
 * @param qrLink   Pre-decoded QR string (so we can exclude it from website extraction)
 */
export function extractFields(rawText: string, qrLink = ''): ExtractedFields {
  // Reset regex lastIndex between calls (they have the `g` flag)
  EMAIL_REGEX.lastIndex = 0
  PHONE_REGEX.lastIndex = 0
  URL_REGEX.lastIndex = 0

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const fullText = rawText.replace(/\s+/g, ' ')

  // ── Email ──────────────────────────────────────────────────────────────────
  const emails = [...(fullText.matchAll(EMAIL_REGEX))].map(m => m[0])
  const email = emails[0] ?? ''

  // ── Phone ──────────────────────────────────────────────────────────────────
  const phones = [...(fullText.matchAll(PHONE_REGEX))]
    .map(m => m[0].trim())
    .filter(p => phoneScore(p) > 0)
    .sort((a, b) => phoneScore(b) - phoneScore(a))
  const phone = phones[0] ?? ''

  // ── Website ────────────────────────────────────────────────────────────────
  URL_REGEX.lastIndex = 0
  const urls = [...(fullText.matchAll(URL_REGEX))]
    .map(m => m[0])
    .filter(u => {
      // Exclude emails (they match URLs too), and the QR link if known
      if (isLikelyEmail(u)) return false
      const norm = normalizeUrl(u)
      if (qrLink && norm === normalizeUrl(qrLink)) return false
      return isLikelyUrl(u)
    })
    .map(normalizeUrl)

  // Deduplicate
  const website = [...new Set(urls)][0] ?? ''

  // ── Address ────────────────────────────────────────────────────────────────
  ADDRESS_REGEX.lastIndex = 0
  const streetMatches = [...(rawText.matchAll(ADDRESS_REGEX))].map(m => m[0].trim())

  // Also look for postal-code-only lines as a fallback
  let address = streetMatches[0] ?? ''
  if (!address) {
    POSTAL_REGEX.lastIndex = 0
    const postalMatch = rawText.match(POSTAL_REGEX)
    if (postalMatch) {
      // Find the line containing the postal code
      const postalLine = lines.find(l => l.includes(postalMatch[0])) ?? ''
      address = postalLine
    }
  }

  // ── Company Name ───────────────────────────────────────────────────────────
  const companyName = extractCompanyName(lines)

  return {
    companyName,
    email,
    phone,
    website,
    qrLink,
    address,
    rawText,
  }
}
