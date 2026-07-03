// ============================================================
// Shared TypeScript types for the Expo OCR Scanner
// ============================================================

/** Normalized coordinates for the crop/ROI box (relative to video dimensions) */
export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A 2D point in image space */
export interface Point {
  x: number;
  y: number;
}

/** Result from documentDetection — whether a document-like rectangle is visible */
export interface DocumentDetectionResult {
  detected: boolean;
  confidence: number; // 0–1
  corners?: [Point, Point, Point, Point]; // top-left, top-right, bottom-right, bottom-left
}

/** Result from stabilityDetection — is the frame stream stable (not jittering) */
export interface StabilityDetectionResult {
  stable: boolean;
  motionScore: number; // lower = more stable
}

/** Result from blurDetection — Laplacian variance sharpness check */
export interface BlurDetectionResult {
  sharp: boolean;
  score: number; // higher = sharper
}

/** Combined readiness status from all three detection pipelines */
export interface DetectionStatus {
  document: DocumentDetectionResult;
  stability: StabilityDetectionResult;
  blur: BlurDetectionResult;
  /** True when all three checks pass simultaneously */
  ready: boolean;
}

/** The structured data extracted from OCR + QR decode */
export interface ExtractedFields {
  companyName: string;
  email: string;
  phone: string;
  website: string;
  qrLink: string;
  address: string;
  rawText: string;
}

/** Sync state for Google Sheets persistence */
export type SyncStatus = 'saved' | 'pending' | 'failed';

/** A single captured/saved record in the session */
export interface ScanRecord {
  id: string;
  timestamp: string; // ISO 8601
  fields: ExtractedFields;
  syncStatus: SyncStatus;
  /** Row number returned by Apps Script (for future edit reference) */
  sheetRowNumber?: number;
}

/** User-configurable app settings (stored in localStorage — text only) */
export interface AppSettings {
  sheetsEndpoint: string;
  cropPreset: 'business-card' | 'a5-brochure' | 'a4-flyer' | 'custom';
  blurThreshold: number; // Laplacian variance threshold, default 100
  stabilityWindow: number; // ms, default 1000
  selectedDeviceId?: string;
}

/** Crop box aspect ratios by preset */
export const CROP_PRESETS: Record<AppSettings['cropPreset'], { aspectRatio: number; label: string }> = {
  'business-card': { aspectRatio: 1.75, label: 'Business Card' },
  'a5-brochure': { aspectRatio: 0.707, label: 'A5 Brochure' },
  'a4-flyer': { aspectRatio: 0.707, label: 'A4 Flyer' },
  'custom': { aspectRatio: 0, label: 'Custom' },
};

/** Default settings values */
export const DEFAULT_SETTINGS: AppSettings = {
  sheetsEndpoint: '',
  cropPreset: 'a5-brochure',
  blurThreshold: 100,
  stabilityWindow: 1000,
};

/** Camera permission states */
export type CameraPermission = 'unknown' | 'requesting' | 'granted' | 'denied' | 'unavailable';

/** Global library load states for OCR/QR libraries */
export interface LibraryStatus {
  opencvReady: boolean;
  tesseractReady: boolean;
  zxingReady: boolean;
}

/** Processing state during the Read pipeline */
export type ReadState =
  | 'idle'
  | 'capturing'
  | 'correcting'
  | 'ocr'
  | 'qr'
  | 'extracting'
  | 'done'
  | 'error';
