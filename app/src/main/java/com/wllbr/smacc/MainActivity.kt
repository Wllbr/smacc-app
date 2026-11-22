package com.wllbr.smacc

import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.os.Message
import android.print.PrintAttributes
import android.print.PrintManager
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
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.google.android.material.progressindicator.LinearProgressIndicator
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
        val restored = savedInstanceState != null && start == null && root.restoreState(savedInstanceState) != null
        if (!restored) root.loadUrl(start ?: homeUrl())
        updateLauncherShortcuts(loadShortcuts())
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra(EXTRA_URL)?.let { cur.loadUrl(it) }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webs.firstOrNull()?.saveState(outState)
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
        webs.forEach { it.destroy() }
        webs.clear()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- web views

    private fun homeUrl() = prefs.getString("home", null) ?: DEFAULT_HOME
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
        stack.removeView(w)
        w.destroy()
        cur.visibility = View.VISIBLE
        updateBars()
    }

    private fun closeTop() { if (webs.size > 1) closeWeb(cur) }

    private fun updateBars() {
        if (webs.isEmpty()) return
        tabBar.isVisible = webs.size > 1
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

        override fun onPageFinished(view: WebView, url: String?) {
            // older WebView without document-start scripts: run the bundle once the page is there
            if (!docStart && isSmacc(url)) view.evaluateJavascript(bundle, null)
            CookieManager.getInstance().flush()
            if (webs.isNotEmpty() && view === cur) updateBars()
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
    }

    private fun printWeb(w: WebView) {
        if (!webs.contains(w)) return
        val pm = getSystemService(PRINT_SERVICE) as PrintManager
        val name = (w.title?.takeIf { it.isNotBlank() } ?: "SMACC").take(60)
        pm.print(name, w.createPrintDocumentAdapter(name), PrintAttributes.Builder().build())
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
            R.id.nav_home -> cur.loadUrl(homeUrl())
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
        pm.setOnMenuItemClickListener {
            when (it.itemId) {
                1 -> showShortcuts()
                2 -> openFind()
                3 -> cur.reload()
                4 -> toggleDesktop()
                5 -> cur.url?.let { u -> prefs.edit().putString("home", u).apply(); toast(getString(R.string.home_set)) }
                6 -> cur.url?.let { u -> openExternal(u) }
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
                w.evaluateJavascript("(function(){var a=window.__zodApp;return a&&a.closePanels()?1:0})()") { r ->
                    if (r == "1" || webs.isEmpty()) return@evaluateJavascript
                    when {
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
