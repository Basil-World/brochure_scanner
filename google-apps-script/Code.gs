/**
 * ============================================================
 * Expo OCR Scanner — Google Apps Script Web App
 * ============================================================
 *
 * SETUP INSTRUCTIONS (also see SETUP.md):
 *
 * 1. Open your target Google Spreadsheet
 * 2. Extensions → Apps Script
 * 3. Delete any existing code and paste this entire file
 * 4. Save (Ctrl+S / Cmd+S)
 * 5. Click "Deploy" → "New deployment"
 * 6. Type: Web app
 * 7. Description: "Expo OCR Scanner"
 * 8. Execute as: Me (your Google account)
 * 9. Who has access: Anyone  ← required for no-login access from the app
 * 10. Click "Deploy" and copy the Web App URL
 * 11. Paste the URL into the Expo OCR Scanner Settings page
 *
 * SECURITY NOTE:
 * "Anyone" access means anyone with the URL can append rows.
 * The URL is not publicly listed anywhere — it's a secret by obscurity.
 * For higher security, restrict to "Anyone with Google Account" and
 * handle OAuth in the app (significantly more complex setup).
 *
 * COLUMN ORDER (DO NOT CHANGE without updating the app):
 * A: Timestamp | B: Company Name | C: Email | D: Phone
 * E: Website | F: QR Link | G: Address | H: Raw OCR Text
 */

const SHEET_NAME = 'Contacts'; // Change this if your sheet tab has a different name

/**
 * Handle POST requests from the Next.js app.
 * Appends one row to the target sheet.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);

    // Create the sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
    }

    // Add headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'Timestamp', 'Company Name', 'Email', 'Phone',
        'Website', 'QR Link', 'Address', 'Raw OCR Text'
      ]);
      // Style the header row
      sheet.getRange(1, 1, 1, 8)
        .setBackground('#1a1a2e')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Append the data row
    const row = payload.row || [];
    sheet.appendRow(row);

    const newRowNumber = sheet.getLastRow();

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        row: newRowNumber,
        message: `Row ${newRowNumber} appended successfully`
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle GET requests — used as a connection test from the app's Settings page.
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      ok: true,
      message: 'Expo OCR Scanner endpoint is active',
      sheet: SHEET_NAME,
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
