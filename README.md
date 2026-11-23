# ZOD SMACC (Android)

SMACC on your phone with the ZOD extension built in: quick search (price, cost, stock per branch),
customer search by name / mobile / VAT / CR with a new invoice for the customer, returns next to
invoices, item tools, faster pages and staying logged in.

## The app's own screens
The app opens on its own screens (`app/src/main/assets/app/`): sign-in, home with today's totals, sales
invoices, returns, quotations, purchases, stock transfers, items (price, cost, stock per branch), customers,
a sales report and settings (language, colour, dark mode, text size, automatic sign-in). Tapping a document
opens it in the app: header, every item line, discount, VAT and totals; returns link to their invoice.
Print / PDF sends SMACC's own print of the invoice straight to Android's print screen.
They read from SMACC with your login and never save anything. Creating or editing a document still opens
SMACC's own screen with the ZOD extension (native versions come from recordings of real saves).

## Install
1. Open **Releases** → latest build → download `ZOD-SMACC.apk` on your phone.
2. Open it and allow "install unknown apps" for your browser when Android asks.
3. Log in to SMACC once; the app keeps you logged in.

New builds install over the old one (same signing key), so your login and shortcuts stay.

## Bottom bar
| Button | Does | On a computer |
|---|---|---|
| Home | your home page (More → Make this page Home to change it) | |
| New | new sales invoice (or add an item when one is open) | F2 |
| Search | quick search: invoices, returns, items with price / cost / stock | Ctrl+K |
| Customers | customer search → new invoice for the customer | F8 |
| More | shortcuts, find on page, refresh, desktop site, open in browser | |

- **Shortcuts:** More → Shortcuts → Pin this page. Pinned pages also appear when you long-press
  the app icon, and each can be added to the home screen as its own icon.
- **Back button:** closes an open search first, then goes back.
- Pages SMACC opens in a new window (prints, cards, returns) open on top, with a blue bar and ✕;
  the page underneath (e.g. an invoice being entered) stays as it was.
- **Print:** SMACC's print opens Android's print screen (print or Save as PDF).
- **Desktop site** (in More): if a SMACC screen looks broken in phone layout.

## Updating the extension
Replace the files in `extension/` with the new version and push. GitHub runs
`tools/build_bundle.py` and builds a new APK in Releases.

Desktop-only parts of the extension: the second window (Alt+Q) and sales invoice drafts in tabs (+).

## Layout
- `extension/` — the Chrome extension, unchanged
- `android-js/` — phone additions: `chrome.*` stand-in, print, viewport, bottom-bar hooks, phone CSS
- `tools/build_bundle.py` — turns the extension into `app/src/main/assets/zod_bundle.js`
- `app/` — the Android app (Kotlin, WebView)
