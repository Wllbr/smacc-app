package com.wllbr.smacc

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ListView
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.progressindicator.LinearProgressIndicator
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONArray
import org.json.JSONObject

/**
 * SMACC in a WebView, with the ZOD extension's scripts (assets/zod_bundle.js) running on every
 * SMACC page, and phone buttons for what the extension does with the keyboard on a computer.
 * Pages SMACC opens with window.open (prints, customer cards, returns) stack on top of the page
 * that opened them, so an invoice being entered is never lost.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val DEFAULT_HOME = "https://sa5.smacc.com/Default.aspx?type=1&showwizard=false"
        const val EXTRA_URL = "com.wllbr.smacc.URL"
        private const val STATE_URL = "zod_url"
        private const val ORIGIN_RULE = "https://*.smacc.com"
    }

    private data class Shortcut(val title: String, val url: String)

    private lateinit var stack: FrameLayout
    private lateinit var progress: LinearProgressIndicator
    private lateinit var tabBar: View
    private lateinit var tabTitle: TextView
    private lateinit var findBar: View
    private lateinit var findInput: EditText
    private lateinit var findCount: TextView
    private lateinit var nav: BottomNavigationView

    private val webs = mutableListOf<WebView>()
    private val cur: WebView get() = webs.last()
    private val prefs by lazy { getSharedPreferences("zod", MODE_PRIVATE) }
    private val bundle by lazy { assets.open("zod_bundle.js").bufferedReader().use { it.readText() } }
    private val docStart by lazy { WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT) }
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res.resultCode, res.data))
        fileCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        stack = findViewById(R.id.web_stack)
        progress = findViewById(R.id.progress)
        tabBar = findViewById(R.id.tab_bar)
        tabTitle = findViewById(R.id.tab_title)
        findBar = findViewById(R.id.find_bar)
        findInput = findViewById(R.id.find_input)
        findCount = findViewById(R.id.find_count)
        nav = findViewById(R.id.nav)

        WebView.setWebContentsDebuggingEnabled(true)   // personal app: chrome://inspect works from a computer
        CookieManager.getInstance().setAcceptCookie(true)

        val root = newWeb()
        pushWeb(root)
        setupFindBar()
        setupNav()
        setupBack()
        findViewById<ImageButton>(R.id.tab_close).setOnClickListener { closeTop() }

        val start = intent?.getStringExtra(EXTRA_URL)
        val saved = savedInstanceState?.getString(STATE_URL)?.takeIf { isSmacc(it) }
        root.loadUrl(start ?: saved ?: appUrl())
        updateLauncherShortcuts(loadShortcuts())
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(EXTRA_URL)?.let { cur.loadUrl(it) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        // Only the address. WebView.saveState kept the whole history (each screen of the app is one entry) and
        // went over Android's 1 MB limit: seen 23/11/2026 on the owner's phone, the app was killed
        // (TransactionTooLargeException) as soon as the barcode scanner opened over it.
        webs.firstOrNull()?.url?.takeIf { isSmacc(it) }?.let { outState.putString(STATE_URL, it) }
    }

    override fun onResume() {
        super.onResume()
        webs.forEach { it.onResume() }
    }

    override fun onPause() {
        CookieManager.getInstance().flush()
        webs.forEach { it.onPause() }
        super.onPause()
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        dropPrintView()
        webs.forEach { it.destroy() }
        webs.clear()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- web views

    private fun homeUrl() = prefs.getString("home", null) ?: DEFAULT_HOME

    /** The app's own screens (assets/app), served on the SMACC address so they can call SMACC. */
    private fun appUrl() = originOf(homeUrl()) + "/zod-app/index.html"

    private fun isApp(url: String?): Boolean = isSmacc(url) && (Uri.parse(url).path ?: "").startsWith("/zod-app/")

    /** WebViews now showing the app's own screens (readable from the bridge's thread, unlike WebView.url). */
    private val appPages = java.util.Collections.newSetFromMap(java.util.concurrent.ConcurrentHashMap<WebView, Boolean>())
    private fun isAppPage(w: WebView) = appPages.contains(w)

    private fun isLoginUrl(url: String?): Boolean = isSmacc(url) && (Uri.parse(url).path ?: "").contains("login", ignoreCase = true)

    private fun goApp() {
        while (webs.size > 1) closeWeb(cur)
        cur.loadUrl(appUrl())
    }

    // ---- saved login (auto sign-in): encrypted on the phone, only ever typed into SMACC's login page
    private val secure by lazy {
        try {
            EncryptedSharedPreferences.create(
                "zod_login", MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC), this,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) { null }
    }
    @Volatile private var expectLogin = false
    private var pendingLogin: Pair<String, String>? = null
    private var lastAutoFill = 0L

    private fun autoMode(): String = prefs.getString("autologin", "") ?: ""
    private fun hasSavedLogin(): Boolean = try { secure?.contains("u") == true } catch (e: Exception) { false }

    private fun saveLogin(l: Pair<String, String>) {
        try { secure?.edit()?.putString("u", l.first)?.putString("p", l.second)?.apply() } catch (e: Exception) { /* not saved */ }
    }

    private fun onLoginPage(w: WebView) {
        if (!isLoginUrl(w.url) || autoMode() != "on") return
        val s = secure ?: return
        val u = s.getString("u", null) ?: return
        val p = s.getString("p", null) ?: return
        val now = System.currentTimeMillis()
        if (now - lastAutoFill < 25_000) { toast(getString(R.string.auto_failed)); return }   // it came back: wrong login?
        lastAutoFill = now
        w.evaluateJavascript("window.__zodFill&&window.__zodFill(${JSONObject.quote(u)},${JSONObject.quote(p)})", null)
    }

    /** A SMACC screen opened right after the login page: signed in. */
    private fun onSignedIn(view: WebView) {
        val l = pendingLogin
        pendingLogin = null
        if (l != null) {
            when (autoMode()) {
                "on" -> saveLogin(l)
                "" -> AlertDialog.Builder(this)
                    .setTitle(R.string.auto_title)
                    .setMessage(R.string.auto_ask)
                    .setPositiveButton(R.string.yes) { _, _ -> prefs.edit().putString("autologin", "on").apply(); saveLogin(l) }
                    .setNegativeButton(R.string.no) { _, _ -> prefs.edit().putString("autologin", "off").apply() }
                    .show()
            }
        }
        if (expectLogin) {
            expectLogin = false
            view.post { if (webs.contains(view)) view.loadUrl(appUrl()) }
        }
    }
    private fun isDesktop() = prefs.getBoolean("desktop", false)

    private fun desktopUa(): String =
        WebSettings.getDefaultUserAgent(this)
            .replace("; wv)", ")")
            .replace(Regex("\\(Linux; Android [^)]*\\)"), "(X11; Linux x86_64)")
            .replace(" Mobile", "")

    private fun isSmacc(url: String?): Boolean {
        if (url == null) return false
        val u = Uri.parse(url)
        return u.scheme == "https" && (u.host ?: "").endsWith(".smacc.com")
    }

    private fun originOf(url: String?): String {
        val u = Uri.parse(if (isSmacc(url)) url else homeUrl())
        return "${u.scheme}://${u.host}"
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun newWeb(): WebView {
        val w = WebView(this)
        w.layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        CookieManager.getInstance().setAcceptThirdPartyCookies(w, true)
        w.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(true)
            builtInZoomControls = true
            displayZoomControls = false
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            userAgentString = if (isDesktop()) desktopUa() else null
        }
        w.addJavascriptInterface(Bridge(w), "ZodAndroid")
        if (docStart) WebViewCompat.addDocumentStartJavaScript(w, bundle, setOf(ORIGIN_RULE))
        w.webViewClient = Client()
        w.webChromeClient = Chrome()
        w.setDownloadListener { url, ua, disposition, mime, _ -> download(url, ua, disposition, mime) }
        w.setFindListener { active, count, done ->
            if (done && webs.isNotEmpty() && w === cur) {
                findCount.text = when {
                    findInput.text.isNullOrEmpty() -> ""
                    count == 0 -> "0/0"
                    else -> "${active + 1}/$count"
                }
            }
        }
        return w
    }

    private fun pushWeb(w: WebView) {
        webs.lastOrNull()?.visibility = View.GONE
        stack.addView(w)
        webs.add(w)
        updateBars()
    }

    private fun closeWeb(w: WebView) {
        val i = webs.indexOf(w)
        if (i <= 0) return   // the first page always stays
        webs.removeAt(i)
        appPages.remove(w)
        stack.removeView(w)
        w.destroy()
        cur.visibility = View.VISIBLE
        updateBars()
    }

    private fun closeTop() { if (webs.size > 1) closeWeb(cur) }

    private fun updateBars() {
        if (webs.isEmpty()) return
        tabBar.isVisible = webs.size > 1
        nav.isVisible = !isApp(cur.url)
        tabTitle.text = getString(R.string.tab_title, webs.size, cur.title ?: "")
        if (findBar.isVisible) closeFind()
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            return when (request.url.scheme) {
                "http", "https", "about", "blob", "data", "javascript" -> false
                else -> { openExternal(request.url.toString()); true }
            }
        }

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val u = request.url
            val path = u.path ?: return null
            if (request.method != "GET" || !isSmacc(u.toString()) || !path.startsWith("/zod-app/")) return null
            val name = path.removePrefix("/zod-app/")
            if (name.contains("..") || name.contains("/")) return null
            val mime = when (name.substringAfterLast('.')) {
                "html" -> "text/html"; "js" -> "text/javascript"; "css" -> "text/css"; else -> "application/octet-stream"
            }
            return try {
                WebResourceResponse(mime, "utf-8", 200, "OK", mapOf("Cache-Control" to "no-store"), assets.open("app/$name"))
            } catch (e: Exception) {
                WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), "".byteInputStream())
            }
        }

        override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
            if (isApp(url)) appPages.add(view) else appPages.remove(view)
            if (webs.isNotEmpty() && view === cur) updateBars()
        }

        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
            if (webs.isNotEmpty() && view === cur) updateBars()
        }

        override fun onPageFinished(view: WebView, url: String?) {
            // older WebView without document-start scripts: run the bundle once the page is there
            if (!docStart && isSmacc(url)) view.evaluateJavascript(bundle, null)
            CookieManager.getInstance().flush()
            if (webs.isNotEmpty() && view === cur) updateBars()
            // back from the login page onto a SMACC screen with no password box: signed in
            if (isSmacc(url) && !isApp(url) && !isLoginUrl(url) && (expectLogin || pendingLogin != null)) {
                val p = (Uri.parse(url).path ?: "").lowercase()
                if (p == "/default.aspx" || p == "/inventory/salesinvoicepage.aspx") {
                    view.evaluateJavascript("(function(){var p=document.querySelector('input[type=password]');return p&&p.offsetParent!==null?1:0})()") { r ->
                        if (r == "0" && webs.contains(view)) onSignedIn(view)
                    }
                }
            }
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onProgressChanged(view: WebView, newProgress: Int) {
            if (webs.isEmpty() || view !== cur) return
            progress.visibility = if (newProgress < 100) View.VISIBLE else View.INVISIBLE
            progress.setProgressCompat(newProgress, true)
        }

        override fun onReceivedTitle(view: WebView, title: String?) {
            if (webs.isNotEmpty() && view === cur) updateBars()
        }

        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            val child = newWeb()
            pushWeb(child)
            (resultMsg.obj as WebView.WebViewTransport).webView = child
            resultMsg.sendToTarget()
            return true
        }

        override fun onCloseWindow(window: WebView) { closeWeb(window) }

        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            fileChooserParams: WebChromeClient.FileChooserParams
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = filePathCallback
            return try {
                filePicker.launch(fileChooserParams.createIntent())
                true
            } catch (e: Exception) {
                fileCallback = null
                false
            }
        }
    }

    /** What the bundle's scripts can call (window.ZodAndroid). */
    private inner class Bridge(private val w: WebView) {
        @JavascriptInterface
        fun print() { runOnUiThread { printWeb(w) } }

        @JavascriptInterface
        fun desktop(): Boolean = isDesktop()

        // ---- the app's own screens and the login page (android.js)
        @JavascriptInterface
        fun expectLogin() { expectLogin = true }

        @JavascriptInterface
        fun loginPage() { runOnUiThread { if (webs.contains(w)) onLoginPage(w) } }

        @JavascriptInterface
        fun loginUsed(user: String, pass: String) {
            runOnUiThread { if (webs.contains(w) && isLoginUrl(w.url) && autoMode() != "off") pendingLogin = user to pass }
        }

        @JavascriptInterface
        fun autoLogin(): String = autoMode()

        @JavascriptInterface
        fun hasLogin(): Boolean = hasSavedLogin()

        @JavascriptInterface
        fun setAutoLogin(on: Boolean) {
            prefs.edit().putString("autologin", if (on) "on" else "off").apply()
            if (!on) forgetLogin()
        }

        @JavascriptInterface
        fun forgetLogin() { try { secure?.edit()?.clear()?.apply() } catch (e: Exception) { /* nothing saved */ } }

        /** The app's own sign-in screen signed in with "sign in automatically" on: keep the login (encrypted). */
        @JavascriptInterface
        fun signedIn(user: String, pass: String) {
            runOnUiThread {
                if (webs.contains(w) && isApp(w.url) && user.isNotEmpty() && pass.isNotEmpty()) {
                    prefs.edit().putString("autologin", "on").apply()
                    saveLogin(user to pass)
                }
            }
        }

        /** Automatic sign-in: the saved login goes back only to the app's own screen (window.__appFill). */
        @JavascriptInterface
        fun autoFill(): Boolean {
            if (autoMode() != "on" || !hasSavedLogin()) return false
            runOnUiThread {
                if (!webs.contains(w) || !isApp(w.url)) return@runOnUiThread
                val s = secure ?: return@runOnUiThread
                val u = s.getString("u", null) ?: return@runOnUiThread
                val p = s.getString("p", null) ?: return@runOnUiThread
                w.evaluateJavascript("window.__appFill&&window.__appFill(${JSONObject.quote(u)},${JSONObject.quote(p)})", null)
            }
            return true
        }

        /** SMACC's print of a document, loaded out of sight, straight to Android's print / PDF screen. */
        @JavascriptInterface
        fun printPage(path: String) {
            runOnUiThread {
                if (webs.contains(w) && isApp(w.url) && path.startsWith("/Inventory/PrintReport.aspx?")) printHidden(originOf(w.url) + path, w)
            }
        }

        /** The app's language (Settings) for Android's own parts too: buttons, messages, the print screen. */
        @JavascriptInterface
        fun setLang(lang: String) {
            val tag = if (lang == "en") "en" else "ar"
            runOnUiThread {
                if (!webs.contains(w) || !isApp(w.url)) return@runOnUiThread
                val cur = AppCompatDelegate.getApplicationLocales().toLanguageTags()
                if (!cur.startsWith(tag)) AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
            }
        }

        /** A file the app's screen made (a stock count as CSV): saved in Downloads, then offered to share. */
        @JavascriptInterface
        fun saveFile(name: String, mime: String, text: String): Boolean {
            if (!isAppPage(w)) return false
            val safe = name.replace(Regex("[\\\\/:*?\"<>|]"), "_").take(80)
            return try {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safe)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
                contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray(Charsets.UTF_8)) } ?: return false
                runOnUiThread {
                    toast(getString(R.string.file_saved, safe))
                    try {
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = mime
                            putExtra(Intent.EXTRA_STREAM, uri)
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        startActivity(Intent.createChooser(send, safe))
                    } catch (e: Exception) { /* saved in Downloads anyway */ }
                }
                true
            } catch (e: Exception) { false }
        }

        /** Barcode with the camera (Google's scanner: no camera permission for this app). The code goes back
         *  through window.__scanned(code); '' = cancelled or not available. */
        @JavascriptInterface
        fun scan() {
            runOnUiThread {
                if (!isAppPage(w)) return@runOnUiThread
                fun back(code: String) { if (webs.contains(w)) w.evaluateJavascript("window.__scanned&&window.__scanned(${JSONObject.quote(code)})", null) }
                try {
                    GmsBarcodeScanning.getClient(this@MainActivity).startScan()
                        .addOnSuccessListener { b -> back(b.rawValue ?: "") }
                        .addOnCanceledListener { back("") }
                        .addOnFailureListener { toast(getString(R.string.scan_failed)); back("") }
                } catch (e: Exception) { toast(getString(R.string.scan_failed)); back("") }
            }
        }

        @JavascriptInterface
        fun setRecording(on: Boolean) { runOnUiThread { if (prefs.getBoolean("rec", false) != on) toggleRecording() } }

        @JavascriptInterface
        fun version(): String = try { packageManager.getPackageInfo(packageName, 0).versionName ?: "" } catch (e: Exception) { "" }

        @JavascriptInterface
        fun recording(): Boolean = prefs.getBoolean("rec", false)

        @JavascriptInterface
        fun log(line: String) {
            if (!prefs.getBoolean("rec", false)) return
            synchronized(recFile) {
                if (recFile.length() < 30_000_000) recFile.appendText(line + "\n")
            }
        }
    }

    private val recFile by lazy { java.io.File(filesDir, "smacc-recording.txt") }

    private fun toggleRecording() {
        val on = !prefs.getBoolean("rec", false)
        if (on) {
            synchronized(recFile) { recFile.delete() }
            prefs.edit().putBoolean("rec", true).apply()
            webs.forEach { it.reload() }
            toast(getString(R.string.rec_on))
            return
        }
        prefs.edit().putBoolean("rec", false).apply()
        try {
            val name = "smacc-recording-" + System.currentTimeMillis() / 1000 + ".txt"
            val values = android.content.ContentValues().apply {
                put(android.provider.MediaStore.Downloads.DISPLAY_NAME, name)
                put(android.provider.MediaStore.Downloads.MIME_TYPE, "text/plain")
            }
            val uri = contentResolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)!!
            contentResolver.openOutputStream(uri)!!.use { out ->
                synchronized(recFile) { if (recFile.exists()) recFile.inputStream().use { it.copyTo(out) } }
            }
            synchronized(recFile) { recFile.delete() }
            AlertDialog.Builder(this).setMessage(getString(R.string.rec_saved, name))
                .setPositiveButton(android.R.string.ok, null).show()
        } catch (e: Exception) {
            toast(getString(R.string.download_failed))
        }
        webs.forEach { it.reload() }
    }

    private fun printWeb(w: WebView) {
        if (!webs.contains(w)) return
        val pm = getSystemService(PRINT_SERVICE) as PrintManager
        val name = (w.title?.takeIf { it.isNotBlank() } ?: "SMACC").take(60)
        pm.print(name, w.createPrintDocumentAdapter(name), PrintAttributes.Builder().build())
    }

    /** A print page in a WebView the user never sees: added under the app's screen (covered by it, so
     *  Android runs its callbacks), printed when the page calls print() itself or once SMACC has drawn the
     *  report (#HdivMain). The app is told how it went through window.__printState. Kept in printView until
     *  the next print (a printing WebView must stay alive). */
    private var printView: WebView? = null
    private val main = Handler(Looper.getMainLooper())

    private fun dropPrintView() {
        printView?.let { stack.removeView(it); it.destroy() }
        printView = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun printHidden(url: String, from: WebView) {
        dropPrintView()
        val v = WebView(this)
        printView = v
        v.settings.javaScriptEnabled = true
        v.settings.domStorageEnabled = true
        stack.addView(v, 0, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        val started = System.currentTimeMillis()
        var done = false
        fun tell(state: String) { if (webs.contains(from)) from.evaluateJavascript("window.__printState&&window.__printState('$state')", null) }
        val go = Runnable {
            if (done || printView !== v) return@Runnable
            done = true
            tell("ready")
            val pm = getSystemService(PRINT_SERVICE) as PrintManager
            val name = (v.title?.takeIf { it.isNotBlank() && !it.startsWith("http") } ?: "SMACC").take(60)
            pm.print(name, v.createPrintDocumentAdapter(name), PrintAttributes.Builder().build())
        }
        v.addJavascriptInterface(PrintHook { main.postDelayed(go, 700) }, "ZodPrint")
        if (docStart) WebViewCompat.addDocumentStartJavaScript(v, "window.print=function(){try{ZodPrint.print()}catch(e){}};", setOf(ORIGIN_RULE))
        val check = object : Runnable {
            override fun run() {
                if (done || printView !== v) return
                val waited = System.currentTimeMillis() - started
                if (isLoginUrl(v.url)) { done = true; tell("login"); dropPrintView(); return }
                if (waited > 120_000) { done = true; tell("timeout"); dropPrintView(); return }
                v.evaluateJavascript(
                    "(function(){if(document.readyState!=='complete')return 0;var m=document.getElementById('HdivMain');" +
                        "if(m)return (m.innerText||'').trim().length;return -((document.body&&document.body.innerText)||'').length})()"
                ) { r ->
                    val n = r?.trim()?.toIntOrNull() ?: 0
                    when {
                        n > 20 -> main.postDelayed(go, 1500)                   // the report is on the page
                        n < -200 && waited > 25_000 -> main.postDelayed(go, 500) // no #HdivMain but a full page
                        else -> main.postDelayed(this, 1000)
                    }
                }
            }
        }
        var watching = false
        v.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                if (!watching) { watching = true; main.postDelayed(check, 1000) }
            }
        }
        v.loadUrl(url)
    }

    class PrintHook(private val onPrint: () -> Unit) {
        @JavascriptInterface
        fun print() { onPrint() }
    }

    private fun download(url: String, ua: String?, disposition: String?, mime: String?) {
        if (url.startsWith("blob:") || url.startsWith("data:")) { toast(getString(R.string.download_unsupported)); return }
        try {
            val name = URLUtil.guessFileName(url, disposition, mime)
            val req = DownloadManager.Request(Uri.parse(url)).apply {
                if (mime != null) setMimeType(mime)
                CookieManager.getInstance().getCookie(url)?.let { addRequestHeader("Cookie", it) }
                if (ua != null) addRequestHeader("User-Agent", ua)
                setTitle(name)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            }
            (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(req)
            toast(getString(R.string.downloading, name))
        } catch (e: Exception) {
            toast(getString(R.string.download_failed))
        }
    }

    private fun openExternal(url: String) {
        try {
            val i = if (url.startsWith("intent:")) Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
            else Intent(Intent.ACTION_VIEW, Uri.parse(url))
            i.addCategory(Intent.CATEGORY_BROWSABLE)
            i.component = null
            i.selector = null
            startActivity(i)
        } catch (e: Exception) {
            toast(getString(R.string.cant_open))
        }
    }

    // ---------------------------------------------------------------- bottom bar

    private fun setupNav() {
        nav.setOnItemSelectedListener { onNav(it.itemId); false }   // buttons, not tabs
        nav.setOnItemReselectedListener { onNav(it.itemId) }
    }

    private fun onNav(id: Int) {
        when (id) {
            R.id.nav_home -> goApp()
            R.id.nav_new -> zod("newInvoice")
            R.id.nav_search -> zod("quick")
            R.id.nav_customers -> zod("cust")
            R.id.nav_more -> showMore()
        }
    }

    /** Calls window.__zodApp.<fn>() in the page (android-js/android.js). */
    private fun zod(fn: String) {
        val w = cur
        w.evaluateJavascript("(function(){var a=window.__zodApp;return a&&a.$fn()?1:0})()") { r ->
            if (r == "1") return@evaluateJavascript
            if (fn == "newInvoice") w.loadUrl(originOf(w.url) + "/Inventory/SalesInvoicePage.aspx#zod-new")
            else toast(getString(R.string.not_ready))
        }
    }

    private fun showMore() {
        val pm = PopupMenu(this, nav.findViewById<View>(R.id.nav_more) ?: nav)
        pm.menu.add(0, 1, 0, R.string.shortcuts)
        pm.menu.add(0, 2, 1, R.string.find_on_page)
        pm.menu.add(0, 3, 2, R.string.refresh)
        pm.menu.add(0, 4, 3, R.string.desktop_site).apply { isCheckable = true; isChecked = isDesktop() }
        pm.menu.add(0, 5, 4, R.string.set_home)
        pm.menu.add(0, 6, 5, R.string.open_browser)
        pm.menu.add(0, 7, 6, R.string.record).apply { isCheckable = true; isChecked = prefs.getBoolean("rec", false) }
        pm.setOnMenuItemClickListener {
            when (it.itemId) {
                1 -> showShortcuts()
                2 -> openFind()
                3 -> cur.reload()
                4 -> toggleDesktop()
                5 -> cur.url?.let { u -> prefs.edit().putString("home", u).apply(); toast(getString(R.string.home_set)) }
                6 -> cur.url?.let { u -> openExternal(u) }
                7 -> toggleRecording()
            }
            true
        }
        pm.show()
    }

    private fun toggleDesktop() {
        val on = !isDesktop()
        prefs.edit().putBoolean("desktop", on).apply()
        val ua = if (on) desktopUa() else null
        webs.forEach { it.settings.userAgentString = ua; it.reload() }
    }

    private fun setupBack() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (findBar.isVisible) { closeFind(); return }
                val w = cur
                if (isApp(w.url)) {
                    w.evaluateJavascript("(function(){return window.__appBack&&window.__appBack()?1:0})()") { r ->
                        if (r != "1") moveTaskToBack(true)
                    }
                    return
                }
                w.evaluateJavascript("(function(){var a=window.__zodApp;return a&&a.closePanels()?1:0})()") { r ->
                    if (r == "1" || webs.isEmpty()) return@evaluateJavascript
                    when {
                        webs.size == 1 && w.copyBackForwardList().let { h -> h.currentIndex > 0 && isLoginUrl(h.getItemAtIndex(h.currentIndex - 1).url) } -> goApp()
                        w.canGoBack() -> w.goBack()
                        webs.size > 1 -> closeWeb(w)
                        else -> moveTaskToBack(true)
                    }
                }
            }
        })
    }

    // ---------------------------------------------------------------- find on page

    private fun setupFindBar() {
        findInput.doAfterTextChanged { cur.findAllAsync(it?.toString() ?: "") }
        findInput.setOnEditorActionListener { _, id, _ ->
            if (id == EditorInfo.IME_ACTION_SEARCH) { cur.findNext(true); hideKeyboard(); true } else false
        }
        findViewById<ImageButton>(R.id.find_prev).setOnClickListener { cur.findNext(false) }
        findViewById<ImageButton>(R.id.find_next).setOnClickListener { cur.findNext(true) }
        findViewById<ImageButton>(R.id.find_close).setOnClickListener { closeFind() }
    }

    private fun openFind() {
        findBar.isVisible = true
        findInput.requestFocus()
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).showSoftInput(findInput, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun closeFind() {
        webs.forEach { it.clearMatches() }
        findInput.setText("")
        findCount.text = ""
        findBar.isVisible = false
        hideKeyboard()
    }

    private fun hideKeyboard() {
        (getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(findInput.windowToken, 0)
    }

    // ---------------------------------------------------------------- shortcuts

    private fun loadShortcuts(): MutableList<Shortcut> {
        val out = mutableListOf<Shortcut>()
        try {
            val a = JSONArray(prefs.getString("shortcuts", "[]"))
            for (i in 0 until a.length()) {
                val o = a.getJSONObject(i)
                out.add(Shortcut(o.getString("t"), o.getString("u")))
            }
        } catch (e: Exception) { /* start empty */ }
        return out
    }

    private fun saveShortcuts(list: List<Shortcut>) {
        val a = JSONArray()
        list.forEach { a.put(JSONObject().put("t", it.title).put("u", it.url)) }
        prefs.edit().putString("shortcuts", a.toString()).apply()
        updateLauncherShortcuts(list)
    }

    private fun showShortcuts() {
        val list = loadShortcuts()
        val labels = listOf(getString(R.string.pin_page)) + list.map { it.title }
        val lv = ListView(this)
        lv.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, labels)
        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.shortcuts)
            .setMessage(if (list.isEmpty()) R.string.shortcuts_empty else R.string.shortcuts_hint)
            .setView(lv)
            .setNegativeButton(R.string.close, null)
            .create()
        lv.setOnItemClickListener { _, _, pos, _ ->
            dialog.dismiss()
            if (pos == 0) pinCurrent() else cur.loadUrl(list[pos - 1].url)
        }
        lv.setOnItemLongClickListener { _, _, pos, _ ->
            if (pos == 0) return@setOnItemLongClickListener false
            dialog.dismiss()
            shortcutActions(list, pos - 1)
            true
        }
        dialog.show()
    }

    private fun nameInput(text: String): Pair<View, EditText> {
        val input = EditText(this).apply { setText(text); setSingleLine(); setSelection(this.text.length) }
        val pad = (20 * resources.displayMetrics.density).toInt()
        val box = FrameLayout(this).apply { setPadding(pad, pad / 2, pad, 0); addView(input) }
        return box to input
    }

    private fun pinCurrent() {
        val url = cur.url ?: return
        val (box, input) = nameInput(cur.title ?: "")
        AlertDialog.Builder(this)
            .setTitle(R.string.name_shortcut)
            .setView(box)
            .setPositiveButton(R.string.save) { _, _ ->
                val l = loadShortcuts()
                l.add(Shortcut(input.text.toString().trim().ifEmpty { "SMACC" }, url))
                saveShortcuts(l)
                toast(getString(R.string.pinned))
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun shortcutActions(list: MutableList<Shortcut>, i: Int) {
        val s = list[i]
        val items = arrayOf(getString(R.string.rename), getString(R.string.add_home_screen), getString(R.string.delete))
        AlertDialog.Builder(this)
            .setTitle(s.title)
            .setItems(items) { _, which ->
                when (which) {
                    0 -> {
                        val (box, input) = nameInput(s.title)
                        AlertDialog.Builder(this)
                            .setTitle(R.string.rename)
                            .setView(box)
                            .setPositiveButton(R.string.save) { _, _ ->
                                list[i] = s.copy(title = input.text.toString().trim().ifEmpty { s.title })
                                saveShortcuts(list)
                            }
                            .setNegativeButton(R.string.cancel, null)
                            .show()
                    }
                    1 -> pinToHomeScreen(s)
                    2 -> { list.removeAt(i); saveShortcuts(list) }
                }
            }
            .show()
    }

    private fun shortcutInfo(id: String, s: Shortcut): ShortcutInfo =
        ShortcutInfo.Builder(this, id)
            .setShortLabel(s.title.take(24))
            .setLongLabel(s.title.take(60))
            .setIcon(Icon.createWithResource(this, R.mipmap.ic_launcher))
            .setIntent(Intent(this, MainActivity::class.java).setAction(Intent.ACTION_VIEW).putExtra(EXTRA_URL, s.url))
            .build()

    private fun updateLauncherShortcuts(list: List<Shortcut>) {
        try {
            val sm = getSystemService(ShortcutManager::class.java) ?: return
            val max = minOf(4, sm.maxShortcutCountPerActivity)
            sm.dynamicShortcuts = list.take(max).mapIndexed { i, s -> shortcutInfo("s$i", s) }
        } catch (e: Exception) { /* launcher without shortcuts */ }
    }

    private fun pinToHomeScreen(s: Shortcut) {
        try {
            val sm = getSystemService(ShortcutManager::class.java) ?: return
            if (sm.isRequestPinShortcutSupported) sm.requestPinShortcut(shortcutInfo("pin" + s.url.hashCode(), s), null)
        } catch (e: Exception) { /* not supported */ }
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
}
