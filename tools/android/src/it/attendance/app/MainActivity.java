package it.attendance.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;

/* Attendance per Android: la stessa app del sito, tutta nel telefono e utilizzabile senza internet.
   La pagina è servita da https://appassets.androidplatform.net/ (origine fissa: i dati restano tra un avvio e l'altro).
   Con internet controlla il sito: se c'è una versione nuova la scarica e propone di aggiornare. */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    static final String SITE = "https://attendance-app-it.netlify.app/index.html";
    static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    static final int VERSION = 1;            // uguale a android:versionCode
    static final int REQ_FILE = 1, REQ_SAVE = 2;

    WebView web;
    ValueCallback<Uri[]> fileCb;
    byte[] pendingBytes;
    String pendingName;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        dropStaleUpdate();
        web = new WebView(this);
        setContentView(web);
        try { getWindow().setStatusBarColor(0xFF4F46E5); } catch (Exception e) { }
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "AttAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String p = u.getPath();
                if (p == null || p.equals("/") || p.length() < 2) p = "/index.html";
                String name = p.substring(1);
                if (name.contains("..")) return notFound();
                try { return new WebResourceResponse(mime(name), "utf-8", open(name)); }
                catch (IOException e) { return notFound(); }
            }
            @SuppressWarnings("deprecation")
            @Override public boolean shouldOverrideUrlLoading(WebView v, String url) {   // versione disponibile in tutte le API
                Uri u = Uri.parse(url);
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                String type = "*/*";
                String[] acc = p.getAcceptTypes();
                if (acc != null) for (String a : acc) for (String t : a.split(",")) { t = t.trim(); if (t.contains("/")) { type = t; break; } }
                if (type.equals("*/*") && acc != null && Arrays.toString(acc).contains(".xlsx")) type = XLSX;
                i.setType(type);
                if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try { startActivityForResult(Intent.createChooser(i, "Scegli"), REQ_FILE); }
                catch (Exception e) { fileCb = null; return false; }
                return true;
            }
        });
        web.loadUrl(START);
        new Thread(new Runnable() { public void run() { checkUpdate(); } }).start();
    }

    static WebResourceResponse notFound() {
        WebResourceResponse x = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        x.setStatusCodeAndReasonPhrase(404, "Not Found");
        return x;
    }
    static String mime(String n) {
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".js")) return "text/javascript";
        if (n.endsWith(".webmanifest") || n.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }
    File updDir() { return new File(getFilesDir(), "aggiornamento"); }
    InputStream open(String name) throws IOException {
        if (name.equals("index.html")) { File f = new File(updDir(), "index.html"); if (f.exists()) return new FileInputStream(f); }
        return getAssets().open("www/" + name);
    }
    /* un aggiornamento scaricato con una versione precedente dell'app non vale più dopo averla reinstallata */
    void dropStaleUpdate() {
        try {
            File v = new File(updDir(), "programma.txt");
            if (updDir().exists() && (!v.exists() || !new String(readAll(new FileInputStream(v)), "UTF-8").equals(String.valueOf(VERSION)))) {
                File[] fs = updDir().listFiles(); if (fs != null) for (File f : fs) f.delete();
            }
        } catch (Exception e) { }
    }
    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream(); byte[] buf = new byte[65536]; int n;
        try { while ((n = in.read(buf)) > 0) o.write(buf, 0, n); } finally { in.close(); }
        return o.toByteArray();
    }
    static byte[] sha1(byte[] b) throws Exception { return MessageDigest.getInstance("SHA-1").digest(b); }

    void checkUpdate() {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(SITE + "?v=" + System.currentTimeMillis()).openConnection();
            c.setConnectTimeout(8000); c.setReadTimeout(60000); c.setUseCaches(false);
            if (c.getResponseCode() != 200) return;
            byte[] b = readAll(c.getInputStream());
            if (b.length < 100000 || !new String(b, "UTF-8").contains("id=\"pl\"")) return;   // non è la pagina dell'app
            if (Arrays.equals(sha1(b), sha1(readAll(open("index.html"))))) return;            // già aggiornata
            File d = updDir(); d.mkdirs();
            File tmp = new File(d, "index.html.tmp");
            OutputStream o = new FileOutputStream(tmp); o.write(b); o.close();
            if (!tmp.renameTo(new File(d, "index.html"))) return;
            OutputStream v = new FileOutputStream(new File(d, "programma.txt")); v.write(String.valueOf(VERSION).getBytes("UTF-8")); v.close();
            runOnUiThread(new Runnable() { public void run() {
                if (isFinishing()) return;
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Aggiornamento")
                    .setMessage("È pronta una nuova versione di Attendance. I tuoi dati restano dove sono.")
                    .setPositiveButton("Aggiorna ora", new DialogInterface.OnClickListener() { public void onClick(DialogInterface di, int w) { web.loadUrl(START); } })
                    .setNegativeButton("Più tardi", null)
                    .show();
            } });
        } catch (Exception e) { /* senza internet: si usa la versione già presente */ }
    }

    /* chiamato dall'app quando si tocca «Scarica Excel» */
    class Bridge {
        @JavascriptInterface public void save(final String name, final String b64) {
            final byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            runOnUiThread(new Runnable() { public void run() {
                pendingBytes = bytes; pendingName = name;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(XLSX);
                i.putExtra(Intent.EXTRA_TITLE, name);
                try { startActivityForResult(i, REQ_SAVE); }
                catch (Exception e) { Toast.makeText(MainActivity.this, "Non riesco ad aprire la finestra per salvare il file", Toast.LENGTH_LONG).show(); }
            } });
        }
    }

    void savedDialog(final Uri u) {
        new AlertDialog.Builder(this)
            .setTitle("Excel salvato")
            .setMessage(pendingName != null ? pendingName : "")
            .setPositiveButton("Condividi", new DialogInterface.OnClickListener() { public void onClick(DialogInterface di, int w) {
                Intent s = new Intent(Intent.ACTION_SEND);
                s.setType(XLSX);
                s.putExtra(Intent.EXTRA_STREAM, u);
                s.setClipData(ClipData.newRawUri("", u));
                s.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivity(Intent.createChooser(s, "Invia il file Excel")); } catch (Exception e) { }
            } })
            .setNeutralButton("Apri", new DialogInterface.OnClickListener() { public void onClick(DialogInterface di, int w) {
                Intent o = new Intent(Intent.ACTION_VIEW);
                o.setDataAndType(u, XLSX);
                o.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivity(o); } catch (Exception e) { Toast.makeText(MainActivity.this, "Nessuna app per aprire file Excel", Toast.LENGTH_LONG).show(); }
            } })
            .setNegativeButton("OK", null)
            .show();
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == REQ_FILE) {
            Uri[] r = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount(); r = new Uri[n];
                    for (int k = 0; k < n; k++) r[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) r = new Uri[] { data.getData() };
            }
            if (fileCb != null) fileCb.onReceiveValue(r);
            fileCb = null;
            return;
        }
        if (req == REQ_SAVE) {
            if (res == RESULT_OK && data != null && data.getData() != null && pendingBytes != null) {
                Uri u = data.getData();
                try {
                    OutputStream o = getContentResolver().openOutputStream(u, "w");
                    o.write(pendingBytes); o.close();
                    savedDialog(u);
                } catch (Exception e) { Toast.makeText(this, "Non riesco a salvare il file", Toast.LENGTH_LONG).show(); }
            }
            pendingBytes = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }
}
