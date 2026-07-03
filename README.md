# Expo OCR Scanner

A mobile-first Progressive Web App that scans trade show brochures and extracts structured contact data (company, email, phone, website, address, QR links) directly into a Google Sheet — with **zero image or video storage**.

---

## Features

- 📸 **Live camera scanning** — Rear camera (environment-facing) with draggable crop overlay
- 🔍 **Smart document detection** — OpenCV.js Canny edge detection + contour analysis
- ⚡ **Best-frame selection** — 1-second ring buffer, picks the sharpest frame automatically
- 🔤 **OCR** — Tesseract.js with preprocessing (grayscale + contrast + threshold)
- 📱 **QR decoding** — ZXing decode-only, decoded string never fetched or navigated
- 📊 **Google Sheets integration** — Saves directly via Apps Script Web App
- 🔒 **Privacy-first** — No images, no video, no binary data ever stored or transmitted
- 📲 **Installable PWA** — Standalone full-screen mode on mobile Chrome/Safari
- 🔌 **Offline handling** — Unsynced records kept locally, retried on reconnect

---

## Architecture

```
Camera → Frame Buffer → ROI Crop → Perspective Correction → 
OCR Engine → QR Detection → Structured Data → Preview → Google Sheets
```

Each stage is a pure, independently callable `lib/` module, designed so future stages (e.g. Gemini API for smarter extraction) can be inserted between "Structured Data" and "Preview" without touching capture logic.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000 in Chrome
```

---

## Configuration

### Google Sheets Setup

1. Follow the step-by-step guide in [`google-apps-script/SETUP.md`](./google-apps-script/SETUP.md)
2. Deploy the Apps Script as a Web App (Anyone access)
3. Copy the Web App URL
4. Open the app → Settings → paste the URL → Test Connection

### Environment Variables

No environment variables are required. The Apps Script endpoint URL is stored in browser `localStorage` (Settings page).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Camera | `MediaDevices.getUserMedia` |
| Image processing | OpenCV.js (CDN) |
| OCR | Tesseract.js v7 |
| QR decode | @zxing/browser |
| State | Zustand |
| Persistence | Google Sheets via Apps Script |
| PWA | Native `manifest.ts` + custom service worker |

---

## Project Structure

```
app/
  layout.tsx          # PWA shell, OpenCV.js script tag, Inter font
  manifest.ts         # PWA manifest (icons, display: standalone, theme)
  page.tsx            # Redirects to /scanner
  scanner/page.tsx    # Main scan screen — camera + crop + Read pipeline
  preview/page.tsx    # OCR result review/edit
  saved/page.tsx      # Session record list + export
  settings/page.tsx   # Sheets URL, crop presets, detection sensitivity

components/
  CameraView.tsx      # <video> stream + permission/error states
  CropOverlay.tsx     # SVG drag/resize ROI box with touch handles
  StatusIndicator.tsx # Document/stability/blur status pills
  OCRPreview.tsx      # Editable field form + raw OCR panel
  BottomToolbar.tsx   # Read (primary) | Records | Settings

lib/
  types.ts                # All shared TypeScript types
  documentDetection.ts    # OpenCV Canny + contour quad detection
  stabilityDetection.ts   # Mean absolute difference frame diff
  blurDetection.ts        # Laplacian variance sharpness
  perspectiveCorrect.ts   # OpenCV homography warp + crop utilities
  ocr.ts                  # Tesseract.js wrapper with preprocessing
  qrScanner.ts            # ZXing decode-only wrapper
  fieldExtraction.ts      # Regex/heuristic field parser (extensible)
  googleSheets.ts         # Apps Script POST client
  sessionStore.ts         # Zustand store (text-only, sessionStorage backed)

hooks/
  useCamera.ts            # Stream lifecycle, permissions, visibility handling
  useFrameBuffer.ts       # ~1s ring buffer + best-frame selection
  useDocumentChecks.ts    # Throttled 120ms detection loop
  useReadiness.ts         # Derives Read button enabled/disabled state

google-apps-script/
  Code.gs                 # Apps Script source (doPost + doGet handlers)
  SETUP.md                # Step-by-step deployment guide
```

---

## Performance Notes

- **Analysis loop**: Runs every 120ms (not on every frame) to protect battery and maintain ≥30fps video
- **OCR pre-warm**: Tesseract.js worker initialised during camera idle (after first detection pass), so Read doesn't cold-start it
- **OpenCV.js**: Loaded lazily after initial paint, cached by the service worker for offline use
- **Memory**: All `ImageBitmap`/`ImageData` objects from the ring buffer are discarded after Read. All `cv.Mat` objects are explicitly `.delete()`-ed to prevent WASM heap growth

---

## Privacy Guarantees

Verifiable by code inspection — search the codebase for these patterns:

| Pattern | Expected result |
|---------|----------------|
| `localStorage.setImage` | No matches |
| `sessionStorage.setItem.*base64` | No matches |
| `fetch.*image` | No matches |
| `IndexedDB` | No matches |
| `canvas.toDataURL` used in storage | Only in QR decode (temp, discarded) |

Only the structured text fields (company, email, phone, website, qrLink, address, rawText) are ever persisted.

---

## Known Limitations

- **OCR accuracy**: Tesseract.js works best on clean, well-lit, printed text. Handwritten notes or low-contrast printing may miss fields — the Raw OCR Text panel lets users hand-copy anything the parser misses.
- **Perspective correction**: Requires OpenCV.js to be loaded (happens on first use, ~2-3s). If OpenCV isn't ready, the plain crop is used.
- **iOS Safari**: `getUserMedia` with `facingMode: environment` may require HTTPS even on localhost. Use a local HTTPS proxy or deploy to Vercel for iOS testing.
- **Session-scoped records**: The session list clears on hard refresh by design. Export CSV before refreshing if you need to keep records.
- **Google Sheets auth**: The Apps Script endpoint uses "Anyone" access — the URL itself is the only authentication mechanism. Do not share the URL publicly.

---

## Building for Production

```bash
npm run build
npm run start
```

For deployment to Vercel (recommended for mobile HTTPS testing):
```bash
npx vercel
```

---

## Adding Gemini API Field Extraction (Future)

The pipeline is designed for this. Insert a new module between field extraction and preview:

```typescript
// lib/geminiExtraction.ts
export async function enhanceWithGemini(
  rawText: string, 
  preliminary: ExtractedFields
): Promise<ExtractedFields> {
  // Call Gemini API with rawText for smarter extraction
  // Return enhanced ExtractedFields
}
```

Then in `app/scanner/page.tsx`, after `extractFields()`, call `enhanceWithGemini()` before `setCurrentScan()`. No other changes needed.
