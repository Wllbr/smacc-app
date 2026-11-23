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
- Branch `native-invoice-view-signin` (2026-11-23, not yet pushed/built): the app's own document screen
  (`#/doc/<si|sr|sq|pi|pr|st>/<number>`: header, item lines, discount/VAT/net, return → original invoice)
  and its own sign-in screen. Print = `ZodAndroid.printPage(path)` → PrintReport loaded in a WebView that is
  never shown → Android print. Sign-in = SMACC's Login.aspx in a hidden same-origin iframe (`txtLoginID`,
  `txtPassword`, `btnLogin` click; leaving Login.aspx = signed in; `#lbMessage` = SMACC's error; captcha /
  OTP modal → button to SMACC's own login page). "Sign in automatically" → `ZodAndroid.signedIn(u,p)`
  saves (encrypted); next time `ZodAndroid.autoFill()` hands it back only via `window.__appFill`.
  Tested on a mock (scratch, not committed) and the real Login.aspx structure; NOT on a phone, NOT a real login.
- Still opening SMACC's own web screen (owner wants these replaced): creating or editing any document,
  making a return, and the login page only for an SMS code / picture code.
- `extension/` + `android-js/` + `tools/build_bundle.py`: the Chrome extension bundled into
  `assets/zod_bundle.js`, injected at document start on SMACC pages (not on `/zod-app/`).
- Auto sign-in: `android-js/android.js` (login-page capture/fill) + MainActivity (EncryptedSharedPreferences).
  Generic (finds the visible password box); **untested**, the login page's structure has not been seen.
- Recorder: Settings → "Record for Claude" logs every XHR/fetch on SMACC pages (not login pages) to
  Downloads as `smacc-recording-<time>.txt` (JSON lines: url, body, status, res cut at 30,000 chars).

## Build
No Android SDK access from Claude's sandbox (Google Maven is blocked): **GitHub Actions is the
compiler**. Push to `main` → `.github/workflows/build.yml` → signed `ZOD-SMACC.apk` in Releases
(`gh run watch`, `gh release download`). The signing keystore is committed on purpose (repo must stay
private) so each build installs over the last. Test `app.js` locally with a mock server + headless Chrome.

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
1. Get recordings (phone recorder, or on PC: Claude in Chrome with the owner logged in, or a HAR
   started after login) of: a cash invoice for a walk-in customer with two items; an invoice for a
   VAT-registered customer; opening an existing sales and purchase invoice; a sales return; a stock
   transfer; each report they use; anything else they do regularly.
2. From those: native invoice view (item lines), then native sales invoice creation, then returns,
   transfers, reports. Remove each link to SMACC's web screen as its native screen lands.
3. Ask the owner how build 3 behaves on their phone (auto sign-in especially).
4. The owner should cancel test invoice INV-110539 (34.50) if it was only a test, and was advised to
   change their SMACC password after pasting it into a chat.
