# Miza — installable mobile app (PWA)

This is a Progressive Web App version of Miza. It stores all your data
locally on your device (IndexedDB) — no server, no backend, works fully
offline once installed.

## Why this instead of an APK

Building a real `.apk` requires the Android SDK and build tools, which
weren't available to compile this. A PWA gets you the same practical
result on a phone — home screen icon, full-screen app window, works
offline — without needing Android Studio or a Play Store listing.

## Important: it must be served over HTTPS (or localhost) to install

Phones will not offer "Add to Home Screen" as a real installable app for
files opened directly (`file://...`). You need to serve these files over
HTTP(S). Easiest options:

**Option A — quick local test on your computer:**
```bash
cd miza-pwa
npx serve .
```
This gives you a `localhost` URL — installable in a desktop browser for
testing, but your phone can't reach your computer's `localhost` directly.

**Option B — get it on your phone (recommended), free static hosts:**
Upload the `miza-pwa` folder to any static hosting service, for example:
- **Netlify** — drag-and-drop the folder at app.netlify.com/drop
- **GitHub Pages** — push this folder to a repo, enable Pages in settings
- **Vercel** — `vercel` CLI or drag-and-drop deploy

Any of these gives you a real `https://` URL you can open on your phone.

## Installing on your phone

**Android (Chrome):**
1. Open the `https://` URL in Chrome
2. Tap the menu (⋮) → "Add to Home screen" or "Install app"
3. Miza now opens full-screen from your home screen, like a native app

**iPhone (Safari):**
1. Open the `https://` URL in Safari
2. Tap the Share icon → "Add to Home Screen"
3. Miza opens full-screen, works offline, has its own icon

## What works offline

Everything. Accounts, categories, and transactions are stored in IndexedDB
on the device itself. There's no sync between devices — this is a local
ledger, same as the desktop version's storage model, just installable.

## Files

```
miza-pwa/
├── index.html          # app shell + install prompt handling
├── app.js              # offline-first logic (IndexedDB, no server calls)
├── styles.css
├── manifest.json        # tells the browser how to install this as an app
├── service-worker.js    # caches the app shell for offline use
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-512-maskable.png
```

## If you outgrow local-only storage

When you're ready for the data to sync across devices or connect to the
backend we built earlier (`miza-app/`), the natural next step is having
`app.js` call that backend's REST API when online and fall back to
IndexedDB when offline — the account/transaction shapes already match.
