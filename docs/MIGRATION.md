# Hornet Control v1.5.0-alpha1 — Modular Frontend

## Files to upload
Upload every file from this folder to the same GitHub directory.

## Configuration
Set `API_URL` and `API_KEY` at the top of `app.js`.

## Important
Because `sw.js` changed, commit all files together and fully restart the installed PWA after deployment.

## Module map
- `index.html` — markup only
- `styles.css` — all styles
- `app.js` — configuration, shared state, startup, service worker registration
- `dashboard.js` — application entry screen boundary
- `scanner.js` — QR scanner
- `aircraft.js` — aircraft card, search, create and edit
- `starlink.js` — Starlink search, create and assignment
- `history.js` — aircraft history
- `qr.js` — QR preview and print queue
- `print.js` — PDF generation and print templates
- `api.js` — Apps Script JSONP transport
- `ui.js` — modals and UI state helpers
- `utils.js` — general helpers
- `sw.js` — PWA cache
