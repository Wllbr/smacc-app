# ZOD SMACC Android app: handoff notes

Personal Android app for the repo owner (a merchant, not a developer; writes short messages, uses
SMACC in Arabic). SMACC (https://sa5.smacc.com) is their cloud accounting system. It has **no public
API**; everything here uses SMACC's internal page calls with the owner's own login session.

## What the owner wants (in their words, most recent first)
1. "I don't want the browser version to ever open. I want the app to have its own thing of
   everything SMACC does": fully native-feeling screens for lists, viewing, **creating** invoices,
   purchases, stock transfers, reports.
2. Options/settings, and automatic sign-in.
3. Originally: an Android version of their Chrome extension (`extension/`, "ZOD SMACC").

## State (build 3, in Releases)
- `app/src/main/assets/app/` (index.html, app.css, app.js): the app's own screens, a small vanilla-JS
  app. MainActivity serves it at `https://<smacc host>/zod-app/` via `shouldInterceptRequest`, so it is
  same-origin with SMACC and `fetch` carries the login cookies. Screens: home (today's totals), document
  lists (sales invoices, sales returns, quotations, purchases, purchase returns, stock transfers), items
  (prices, cost, stock per branch), customers, reports (period totals + daily chart), settings.
  **Read-only.** Tested only against a mock built from one recording, never on a phone or live SMACC.
- Branch `native-invoice-view-signin` (2026-11-23, built from the branch by a manual run = Release
  `build-5`; not merged into main): the app's own document screen
  (`#/doc/<si|sr|sq|pi|pr|st>/<number>`: header, item lines, discount/VAT/net, return → original invoice)
  and its own sign-in screen. Print = `ZodAndroid.printPage(path)` → PrintReport loaded in a WebView that is
  never shown → Android print. Sign-in = SMACC's Login.aspx in a hidden same-origin iframe (`txtLoginID`,
  `txtPassword`, `btnLogin` click; leaving Login.aspx = signed in; `#lbMessage` = SMACC's error; captcha /
  OTP modal → button to SMACC's own login page). "Sign in automatically" → `ZodAndroid.signedIn(u,p)`
  saves (encrypted); next time `ZodAndroid.autoFill()` hands it back only via `window.__appFill`.
  Tested on a mock (scratch, not committed) and the real Login.aspx structure; NOT on a phone, NOT a real login.
- Same branch, next commit (2026-11-23, owner: "I want to be able to create an invoice and returns and all
  other through the app" + "the Print/PDF button just shows preparing and nothing happens"):
  - **Print fix** (MainActivity `printHidden`): the old hidden WebView was never attached to a window, so
    `View.post` never ran. Now a WebView is added to the view stack behind the app's page, polled every
    second until PrintReport's `#HdivMain` has text (SMACC takes 40–60 s), or SMACC calls `window.print`
    (`ZodPrint.print`), then `PrintManager.print`. Reports back via `window.__printState('ready'|'login'|'timeout')`.
  - **Making documents** (`#/new/<si|sq|pi|st>[/<customer code>]`, `#/new/<sr|pr>[/<invoice no>]`,
    app.js "making documents" + `assets/app/form.js`). The app's screen builds a draft (localStorage
    `zodapp|draft|<kind>`); SMACC's own `<Page>.aspx` is opened in a hidden same-origin iframe
    (`zod-app-form`) and driven like a person: header boxes `$(sel).val(v).blur()` / `.change()`, each item
    through SMACC's item window (`#ItemCode` blur → `#Quantity`/`#Price`/`#DiscountAmount` → `.OkDialog`),
    returns via `#InvoiceNumber` + `#btnSearchInvoice` + quantities / `#chkAllItem`. The review shows what
    SMACC's page then holds (grid lines, totals, SMACC's messages). "Save in SMACC" clicks SMACC's own
    `.btnSaveAddUpdate`; SMACC builds and sends CollectHeader/CollectGrid/posting/SaveRec itself. The app
    only reads SaveRec's answer (`success||<no>`) and mirrors any SMACC modal as a question in the app.
    Every step up to Save was run on the live pages on 23/11/2026 for all six kinds (test forms cancelled);
    **Save itself has never been pressed from the app.** The UI was tested on the mock with a stand-in engine.
  - Why this and not hand-built save calls: the owner's rule below forbids guessing SMACC's save calls;
    here SMACC's own page makes them. The remaining risk is that SMACC's page behaves differently when
    Save is pressed from a hidden frame (a question it asks via `confirm()` is answered "no", so it would
    stop, not save). The first real save from the app should be done by the owner with Settings → "Record
    for Claude" on, then checked in SMACC.
  - SMACC refuses a return for an invoice whose ZatcaInvoiceStatus is not 1 or 3 (e.g. today's, -1) with
    "لم يتم العثور على الفاتوره"; the app explains this.
  - Lists used (exact SMACC calls): `AutoCompleteSearchCodeName` with `table` `INV_SalesmanNames`
    (subSupport ''), `INV_WarehouseNames` (subSupport '0'), `INV_SuppliersNames` (key = btoa(encodeURIComponent
    (text)) or '' for the first 20). Cash customer code '2' (نقدي).
- Same branch, build 7 (2026-11-23, owner: auto sign-in broken, stuck when logged out, customer search,
  new customer while invoicing, branch locks, transfer rights + transfer button, smoother invoice, cost +
  stock in item search, Arabic, opening stock + stock adjustment + counting tools):
  - **Signed out**: SMACC answers HTTP 500 "ConnectionString property has not been initialized" (or its
    `/Login.aspx/CheckLoggedInUserSessionStatus` says so) → `post()` treats it as signed out → sign-in screen.
  - **Rights** = the links in `#side-menu` of `/Default.aspx?type=1&showwizard=false` (DOMParser, lowercase
    page names like `stocktransferpage`; cached 4 h, `zodapp|perms`). `can(page)` hides tiles, document
    tabs, the transfer button, and `#/new/<kind>` shows "no access". Unknown = shown (SMACC still decides).
  - **Locks** = SMACC globals `_linkedWarehouseCode/Name`, `_linkedSalesmanCode/Name` and the disabled
    header boxes after "new" (`F.locks()`), learnt per kind (`zodapp|locks`) and shown as fixed rows.
  - **Customers**: CustomersPage `LoadPageListing` search fields are `Name`, `CustomerCode`, `Phone1`,
    `VATNumber` (NOT `CustomerName`, the old bug). Local index `zodapp|cidx` (500-row pages while idle,
    weekly refresh); CR numbers learnt from LoadRec (`OtherBuyerID`/`BuyerIDValue`). History = sales
    invoice/return lists searched by `CustomerName`, filtered by code. New customer = SMACC's own window
    on SalesInvoicePage (`btnCustCreate` → `#a001` new → fields `..._NewCustomerAndAccountCreationForm1_*`
    → `#a005` save → CustomersPage SaveRec answer `...<||><code>`). Dry-run live 23/11: SMACC empties the
    mobile box when the number is on another customer ("تليفون السجل موجود مسبقا"); F.newCustomer then
    stops. **Its save has never been pressed.**
  - **Cost/stock**: `SelectItemCardUnitString { 'itemCode','unitType':'1' }` → Table[0].AverageCost;
    `SelectItemCardCurrentStockInAllWarehouses { 'itemCode' }` → rows WarehouseCode, WarehouseName,
    ItemCode, CurrentQuantity (checked live 23/11). Item search passes `warehouseCode` for branch stock.
  - **Speed**: the SalesInvoicePage iframe is warmed while home is idle and kept parked; pre-started when
    the invoice screen opens; item searches cached 45 s; redraws don't steal typing.
  - **Stock count** (`#/inv`, `#/inv/c/<id>`, `#/inv/d/<id>`; counts in localStorage `zodapp|count|<id>`),
    CSV export via `ZodAndroid.saveFile` (Downloads + share), camera scan via `ZodAndroid.scan` (Google
    code scanner, no camera permission) → `window.__scanned(code)`.
  - **Stock adjustment** (`#/new/sa/<count id>`, StockAdjustmentPage): header `cpBulk_cpForm_WarehouseCode`
    (blur) / `WarehouseName` / `ReferenceNumber`, add `#cpBulk_cpForm_btnAddNew`, item window
    `#ItemCode` blur → `PhysicalQty1` 0 + `PhysicalQty2` counted → SMACC fills `AdjustedQuantity`,
    `Price` (avg cost), `Amount`. Dry-run live 23/11 (filled, read, cancelled). Items whose difference is 0
    now are skipped. Save answer format unknown: save is "loose" and the app finds the new document by
    its ReferenceNumber in `LoadPageListing`. **Never saved from the app.**
  - **Opening stock** (`#/new/os`, ItemCardOpeningStockPage, a plain page): `txtWarehouseCode` blur,
    `ddlSearchType`=itemcode, `txtOpenSearch`, `btnOpenSearch`, pick in `ddlOpenSearch`; units
    `ListViewDropdown_txtUnitQuantity_<i>` / `txtUnitFraction_<i>`; cost `lbBaseUnitAverageCostPrice`
    (0 when the item has no opening cost; the app offers the average cost); save `btnSaveForm`, then the
    item is loaded again to compare. Load dry-run live 23/11. **Never saved from the app.**
  - Tested: mock server + stand-in engine for every screen (scratch, not committed); live read-only/dry
    checks above.
- Build 8 (2026-11-23, first test on the owner's phone, a OnePlus 8 / Android 13, over USB with adb + the
  WebView's DevTools socket `webview_devtools_remote_<pid>`, `adb forward tcp:9229`):
  - **Crash fixed**: `onSaveInstanceState` used `WebView.saveState` (the whole history, ~1.1 MB) →
    TransactionTooLargeException → Android killed the app whenever it went behind another screen (seen when
    the barcode scanner opened; also hits after switching apps). Now only the URL is kept (`zod_url`).
  - **CR numbers**: SMACC's customer list has CCRNumber for ~4 of 14,497 customers. A background reader
    (`crStep`) reads `CustomersPage LoadRec` for customers with a VAT number while the app is idle (one every
    0.4 s; on the phone 27 of the first 38 cards had a CR), keeping `[OtherBuyerID, BuyerIDValue]` in `zodapp|cbm` (`['','']` = read, none).
  - Branch and salesperson lists kept on the phone (`zodapp|list|<table>`), refreshed behind: the invoice
    screen drew in 0.7 s on a cold start, waiting for them.
  - Measured on the phone: customer search by name / mobile / VAT / code 0.1–0.25 s; item search 0.6 s,
    cost for the first 15 within 3 s; invoice screen 0.05 s when warm.
- Build 10 (2026-11-23, owner: "our items don't have barcodes; we want to scan and add them to the item while
  we do the count; we will choose the products by searching by name"):
  - SMACC's item card: each unit row has a unit code (`.ItemUnitCode`, required, = the item code by default) and
    a barcode button `.AddViewBarCode` (units tab, edit mode) that opens `#BarCodeModal` "إضافة باركود": a list of
    extra barcodes (`#btnAddBarCodesExtended` adds a line, input `.AllowForwardSlashChar` maxlength 40,
    onblur `CheckItemCardCodeIsExists` = client-only check within this item; `#btnOkDialog` "تم" writes
    `data-itemcardbarcodedetails` = JSON [{ItemCode, ItemCardCode, UnitType}] on the row; the item's Save sends
    it). Read: `ItemCardMasterPage.aspx/GetItemCardCodesExtendedByItemCode` `{ 'itemCode' : 'X'}` → '' or that
    JSON. Some items already have one (020003 → 6285002010583).
  - `AutoCompleteSmartCodeNameSearch` finds an item by an extra barcode (name comes back with " - <unit>");
    `isExact 'True'` returns only an exact item code or barcode (checked live). So a linked barcode works on
    every phone and in SMACC's own invoice screen.
  - App: count screen — scan an unknown barcode (camera, or 8–14 digits from a reader) → "pick the item by name"
    → the item's window opens with the barcode filled; or open an item by name and scan into "باركود الصنف".
    Checks before queueing: valid (letters/digits, no spaces — SMACC's own box took a space when set by
    script), not the item code, not on another item (exact search), not queued for another item. Queue
    `zodapp|bcq` on the phone; `bcRun` puts one at a time into SMACC with `form.js icAddBarcode` (open item via
    `ddlOpenSearch`, `.btnUpdate1`, units tab, barcode button, إضافة باركود, type, تم, SMACC's Save), then reads
    the barcodes back (ok only if SMACC has it). Only for logins with the item card page.
  - Dry-run live 23/11 (Chrome, form.js loaded into a SMACC tab): items 020004 and 020003, every step up to Save,
    then cancelled; server unchanged, 0 SaveRec. **The item Save has never been pressed from the app.** UI tested
    on the mock (link, conflicts, failure, retry).
- Still opening SMACC's own web screen: editing a saved document, and the login page only for an SMS
  code / picture code.
- `extension/` + `android-js/` + `tools/build_bundle.py`: the Chrome extension bundled into
  `assets/zod_bundle.js`, injected at document start on SMACC pages (not on `/zod-app/`).
- Auto sign-in: `android-js/android.js` (login-page capture/fill) + MainActivity (EncryptedSharedPreferences).
  Generic (finds the visible password box); **untested**, the login page's structure has not been seen.
- Recorder: Settings → "Record for Claude" logs every XHR/fetch on SMACC pages (not login pages) to
  Downloads as `smacc-recording-<time>.txt` (JSON lines: url, body, status, res cut at 30,000 chars).

## Build
No Android SDK access from Claude's sandbox (Google Maven is blocked): **GitHub Actions is the
compiler**. Push to `main` → `.github/workflows/build.yml` → signed `ZOD-SMACC.apk` in Releases
(`gh run watch`, `gh release download`). The signing keystore is committed on purpose so each build
installs over the last. The repo is public: the owner was told the key and its password are visible and
chose on 2026-11-23 to keep the project public; don't ask again. Test `app.js` locally with a mock server + headless Chrome.

## Rules agreed with the owner
- Never type the owner's SMACC password anywhere. They log in themselves.
- Don't guess how SMACC saves things: a wrong invoice is reported to ZATCA and can't be undone. Build a
  create/save screen only from a recording of that exact action, and tell the owner what is untested.
- Don't commit recordings or HAR files (they hold customer and sales data, and HARs hold a session cookie).

## What SMACC's calls look like (from the owner's recording)
All are `POST`, `Content-Type: application/json; charset=utf-8`, body in SMACC's single-quote style,
answer `{"d": ...}` where `d` is often a JSON string. SMACC answers one request at a time per login.

Lists (every document page): `<Page>.aspx/LoadPageListing`
`{ 'CurrentPage' : '1', 'RecordsPerPage' : '10' ,'DDLSearchSelectedValue' : '0', 'SearchText' : '' }`
→ `{pageList, totalRecords, totalPages}`. Oldest first (newest = last page). Search: put a field name in
`DDLSearchSelectedValue` (`InvoiceNumber`, `DocumentNumber`, `CustomerName`, `SupplierName`, `CustomerCode`).
Pages: `/Inventory/SalesInvoicePage`, `SalesReturnPage`, `SalesQuotationPage`, `PurchaseInvoicePage`,
`PurchaseReturnPage`, `StockTransferPage`, `CustomersPage` (`LoadRec { 'key' : '<code>'}` = one customer).

`/WebServices/CommonWebService.asmx/`: `AutoCompleteSmartCodeNameSearch` (items; `codeOrName` =
btoa(encodeURIComponent(text)); rows `code<-|->name<-|-> | price<-|-> | stock`), `SelectItemCardUnitString`
(units, cost, `PriceChannelDetails` "1|name|price|1;2|…"), `SelectItemCardCurrentStockInAllWarehouses`,
`SelectItemCardDetailString`, `SelectInventoryCost`, `CalculateTaxAmounts`, `AutoCompleteSearchCodeName`
(`table`: `INV_WarehouseNames`, `INV_SalesmanNames`), `SelectPriorityPriceChannels`, `GetSmaccDate`.
Dashboard: `/Default.aspx/Select_Graph_FooterValues` and `GetChartData` (chart ids 408 sales, 409 sales
returns, 403 purchases, 404 purchase returns; dates `dd/mm/yyyy`).
Print: `/Inventory/PrintReport.aspx?page_id=403003&record_number=<btoa(invoice no)>` (sales invoice;
the sales return page's id is 403004, from its SelectZATCAWarningAndErrors call; its print is unverified).

Opening a saved document (seen 23/11/2026 in SMACC's own pages, view only): `<Page>.aspx/LoadRec`
`{ 'key' : '<no>', 'rowIndex' : '0'}` → header JSON (~280 fields), plus per page: PurchaseInvoicePage
adds `, 'invoiceDate' : ''`; SalesQuotationPage adds `, 'isProcessTypeCall' : 'false', 'warehouseCode' : '',
'salesmanCode' : '', 'quotationDate' : ''`. Lines: Sales/PurchaseInvoicePage `LoadInvoiceDetails
{ 'orderNumber' : '<no>'}`, Sales/PurchaseReturnPage `LoadReturnDetails { 'documentNumber' : '<no>'}`,
StockTransferPage `LoadItemDetails { 'key' : '<no>'}`, SalesQuotationPage `LoadQuotationDetails { 'key' : '<no>'}`.
PaymentType: sales 1 نقدي, 2 أجل, 3 البنك, 4 الشبكة, 6 الدفع عند الاستلام, 7 الدفع الالكتروني; purchases
1 نقدي, 2 أجل, 3 البنك; sales return 1 نقدي, 2 على الحساب. TaxCategoryCode 1 ضريبية, 2 مبسطة.

### Saving a sales invoice (ONE sample only: credit sale, customer with VAT number, one item)
On `/Inventory/SalesInvoicePage.aspx/`, in this order, state held in the server session:
1. `IsNewRecordAllowed`; `CommonWebService/ValidateDateOnServer {'date','validationOption':'4'}`;
   `GetCreditLimit { customerCode, salesmanCode, creditAmount }`
2. `CollectHeader { 'data' : '<JSON string, ~180 fields>' }` → "success"
3. `CollectGrid { 'data' : '<JSON array, one object per line, ~95 fields>' }` → "success"
4. `CheckPostingAccountSetup { warehouseCode, paymentType, isAccountLinked }` → posting rows (server-computed)
5. `CollectPostingAccounts { "data" : "<those rows>" }` → "success"
6. `SaveRec { isAuto:"true", isInserting:"true", warehouseCode, paymentType, isAccountLinked:"true",
   isBatchDataReq:"false", isZATCAReGenerateInvoice:"false" }` → `success||INV-110539`
Names in header/grid (`CustomerName`, `WarehouseName`, `SalesmanName`, `ItemName`, `UnitName`) are
btoa(encodeURIComponent(text)). In the sample: `PaymentType "2"`, `TaxCategoryCode "1"`, `ProcessType "0"`,
`OtherBuyerID "CRN"`, tax group `SalesTax15`, `PriceChannelCode "1"`. **Unknown:** the values for a cash
sale, a simplified (walk-in) invoice, discounts, several lines, other units. Do not ship native creation
until recordings cover those.

## Next steps
0. Owner: make one real cash sale from the app with "Record for Claude" on; check it in SMACC; send the
   recording. Then a return the same way. Fix whatever differs before relying on it. Same for the first
   new customer, the first stock adjustment and the first opening stock entry.
0b. Test on the owner's phone over USB (adb in the session scratchpad; owner offered): auto sign-in,
   sign-out recovery, scanner, CSV save/share, language switch (AppCompat recreates the activity once).
1. Get recordings (phone recorder, or on PC: Claude in Chrome with the owner logged in, or a HAR
   started after login) of: a cash invoice for a walk-in customer with two items; an invoice for a
   VAT-registered customer; opening an existing sales and purchase invoice; a sales return; a stock
   transfer; each report they use; anything else they do regularly.
2. From those: native invoice view (item lines), then native sales invoice creation, then returns,
   transfers, reports. Remove each link to SMACC's web screen as its native screen lands.
3. Ask the owner how build 3 behaves on their phone (auto sign-in especially).
4. The owner should cancel test invoice INV-110539 (34.50) if it was only a test, and was advised to
   change their SMACC password after pasting it into a chat.
