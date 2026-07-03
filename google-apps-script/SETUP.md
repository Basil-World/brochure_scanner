# Google Apps Script Setup Guide

This guide will connect your Expo OCR Scanner app to a Google Sheet so scanned records are saved automatically.

## Step 1 — Create a Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet
2. Name it something like **"Expo Leads 2026"**
3. The sheet tab at the bottom can stay as "Sheet1" — the script will rename it to "Contacts" automatically

## Step 2 — Open Apps Script

1. In your spreadsheet, click **Extensions** → **Apps Script**
2. A new browser tab opens with the Script editor
3. **Delete all existing code** in the editor (select all, then delete)

## Step 3 — Paste the Script

1. Open the file `Code.gs` from this folder
2. Copy its entire contents
3. Paste into the Apps Script editor
4. Save with **Ctrl+S** (Windows) or **Cmd+S** (Mac)
5. Name the project **"Expo OCR Scanner"** when prompted

## Step 4 — Deploy as Web App

1. Click the blue **Deploy** button (top right) → **New deployment**
2. Click the gear icon ⚙ next to "Type" → select **Web app**
3. Fill in:
   - **Description**: `Expo OCR Scanner v1`
   - **Execute as**: `Me` (your Google account)
   - **Who has access**: `Anyone`
4. Click **Deploy**
5. You may be asked to authorize the script — click **Authorize access** and allow it
6. **Copy the Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

## Step 5 — Configure the App

1. Open Expo OCR Scanner on your phone
2. Tap **Settings** (bottom toolbar)
3. Paste the Web App URL into the **"Apps Script Web App URL"** field
4. Tap **Test Connection** — you should see ✓ Connection successful

## Column Layout

The script creates these columns automatically:

| Column | Content |
|--------|---------|
| A | Timestamp (ISO 8601) |
| B | Company Name |
| C | Email |
| D | Phone |
| E | Website |
| F | QR Link |
| G | Address |
| H | Raw OCR Text |

## Customising the Sheet Name

By default, the script saves to a tab called **"Contacts"**. To change this:
1. Open Apps Script again
2. Find `const SHEET_NAME = 'Contacts';` at the top
3. Change `'Contacts'` to your preferred tab name
4. Save and redeploy (Deploy → Manage deployments → Edit → New version → Deploy)

## Security Note

> **⚠ Important:** The Web App is deployed with "Anyone" access, which means anyone with your URL can append rows. The URL is not publicly listed — it's secret by obscurity.
>
> For stricter access: change "Who has access" to "Anyone with a Google Account" and handle sign-in in the app (requires OAuth, significantly more complex).

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Test Connection" fails | Make sure you deployed as "Anyone" access, not "Only myself" |
| Rows appear with wrong columns | Re-deploy with the latest `Code.gs` — delete old headers in the sheet manually |
| "Authorization required" error | Re-deploy and go through the authorization flow again |
| CORS errors in browser console | Ensure POST body uses `Content-Type: text/plain` (already handled by the app) |
