# ZOD SMACC (Android)

SMACC on your phone with the ZOD extension built in: quick search (price, cost, stock per branch),
customer search by name / mobile / VAT / CR with a new invoice for the customer, returns next to
invoices, item tools, faster pages and staying logged in.

## The app's own screens
The app opens on its own screens (`app/src/main/assets/app/`): sign-in, home with today's totals, sales
invoices, returns, quotations, purchases, stock transfers, items (price, cost, stock per branch), customers,
a sales report and settings (language, colour, dark mode, text size, automatic sign-in). Tapping a document
opens it in the app: header, every item line, discount, VAT and totals; returns link to their invoice.
Print / PDF loads SMACC's own print of the document out of sight (it can take up to a minute) and then
opens Android's print screen (print or Save as PDF).

**New documents in the app:** sales invoice, quotation, purchase invoice, stock transfer, sales return and
purchase return. You pick the customer / supplier, branch, salesperson, payment and items on the app's
screen (the draft is kept if you leave). "Review and save" has SMACC's own page for that document, opened
out of sight, fill everything in: SMACC looks up the names, prices, stock and VAT, and the review shows
SMACC's own figures and messages (for example not enough stock). Nothing is saved until you press
"Save in SMACC", which presses SMACC's own Save button; the app then shows the number, with Print / PDF.
For a return, type the invoice number (or open the invoice → "Make a return"); SMACC loads what is left
to return. SMACC does not allow returns for invoices not yet sent to ZATCA (usually today's).
Editing a saved document still opens SMACC's own screen.

**Arabic first.** The app starts in Arabic (right to left); Settings → Language switches to English, and
Android's own buttons and messages follow.

**Customers.** Search by name, mobile, VAT number, CR number or code. The customer list is kept on the
phone (filled in the background, refreshed weekly) so mobile and CR searches are instant. A customer's
card shows their invoices, returns, totals and the items they bought. "+ New customer" works from the
customers screen and while making an invoice: name and mobile, plus VAT / CR and address for a VAT
customer; it warns about duplicates and is created through SMACC's own customer window.

**Making an invoice.** Item search shows the price, the average cost (red when the price is below it;
Settings → Show cost) and the stock in the invoice's branch; each line shows its branch stock and is
marked when there is not enough. Barcode scanning with the camera. When SMACC holds a user to one
branch or salesperson, the app shows it fixed instead of a choice. Users with transfer rights in SMACC
get "Transfer stock to this branch": it finds the branch that has the missing items and makes a stock
transfer draft. Tiles and pages a user has no rights to in SMACC are hidden. The invoice page is made
ready while the home screen is idle so review is quicker (Settings → Keep the invoice page ready).

**Stock count, adjustments, opening stock.** Stock count (جرد المخزون): pick the branch, scan or type
codes; quick mode adds 1 per scan; blind count hides SMACC's quantity. "Differences" compares with
SMACC's quantity and values surplus and shortage at average cost; export to Excel (CSV); send the
differences to SMACC as a stock adjustment (تسوية مخزون), which shows SMACC's own figures before
saving and finds the saved number afterwards. The adjustments list shows SMACC's adjustments. Opening
stock (مخزون أول المدة) enters each item's quantity per unit and cost through SMACC's own page, and can
take quantities from a count. Counts stay on the phone until deleted. Items with no barcode: find the item by
name and scan its barcode in the item's window (or scan first, then pick the item by name). The app adds it to
the item in SMACC as an extra barcode (item card → units → إضافة باركود), one at a time in the background, and
reads it back to be sure; SMACC's item search then finds the item by it on every phone and on the PC. Needs the
item card page in SMACC.

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
