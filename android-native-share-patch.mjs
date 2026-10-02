import fs from "node:fs";
import path from "node:path";

const config = JSON.parse(fs.readFileSync("capacitor.config.json", "utf8"));
const appId = String(config.appId || "").trim();
if (!appId) throw new Error("capacitor.config.json appId is missing");

const javaDir = path.join("android", "app", "src", "main", "java", ...appId.split("."));
const mainActivity = path.join(javaDir, "MainActivity.java");
const pluginFile = path.join(javaDir, "NativeSharePlugin.java");
const manifestFile = path.join("android", "app", "src", "main", "AndroidManifest.xml");

fs.mkdirSync(javaDir, { recursive: true });

fs.writeFileSync(mainActivity, `package ${appId};

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static Intent pendingShareIntent;

    private static boolean isShareIntent(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        return Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action);
    }

    private static synchronized void captureShareIntent(Intent intent) {
        if (!isShareIntent(intent)) return;
        pendingShareIntent = new Intent(intent);
    }

    public static synchronized Intent consumePendingShareIntent() {
        Intent intent = pendingShareIntent;
        pendingShareIntent = null;
        return intent;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        /* Capture the launch share before Capacitor starts the bridge. */
        captureShareIntent(getIntent());
        registerPlugin(NativeSharePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        /* Capture warm-start shares directly at Activity level.
           setIntent() also keeps Activity.getIntent() current. */
        captureShareIntent(intent);
        setIntent(intent);
        super.onNewIntent(intent);
    }
}
`);

fs.writeFileSync(pluginFile, `package ${appId};

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Set;

@CapacitorPlugin(name = "NativeShare")
public class NativeSharePlugin extends Plugin {
    private static final int MAX_FILES = 6;
    private static final int MAX_FILE_BYTES = 16 * 1024 * 1024;

    private boolean isShareIntent(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        return Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (!isShareIntent(intent)) return;

        /* MainActivity already captured the Intent before Bridge dispatch.
           This event only wakes JS; payload remains pending until consumed. */
        JSObject event = new JSObject();
        event.put("available", true);
        notifyListeners("shareAvailable", event, true);
    }

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        Intent intent = MainActivity.consumePendingShareIntent();

        if (!isShareIntent(intent)) {
            JSObject empty = new JSObject();
            empty.put("empty", true);
            call.resolve(empty);
            return;
        }

        try {
            call.resolve(buildPayload(intent));
        } catch (Exception e) {
            call.reject("Не удалось прочитать Android Share: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void ping(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("plugin", "NativeShare");
        call.resolve(ret);
    }

    private JSObject buildPayload(Intent intent) {
        JSObject out = new JSObject();
        out.put("empty", false);
        out.put("action", String.valueOf(intent.getAction()));

        CharSequence subject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);

        out.put("title", subject == null ? "Android Share" : subject.toString());
        out.put("text", text == null ? "" : text.toString());
        out.put("url", "");

        JSArray files = new JSArray();
        JSArray errors = new JSArray();

        Set<Uri> uris = collectUris(intent);
        int count = 0;

        for (Uri uri : uris) {
            if (count >= MAX_FILES) {
                errors.put("Получено больше " + MAX_FILES + " файлов; лишние пропущены");
                break;
            }

            try {
                files.put(readFile(uri));
                count++;
            } catch (Exception e) {
                errors.put("Не удалось прочитать " + safeName(uri) + ": " + e.getMessage());
            }
        }

        out.put("files", files);
        out.put("errors", errors);
        return out;
    }

    @SuppressWarnings("deprecation")
    private Set<Uri> collectUris(Intent intent) {
        LinkedHashSet<Uri> out = new LinkedHashSet<>();

        try {
            Uri one = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (one != null) out.add(one);
        } catch (Exception ignored) {}

        try {
            ArrayList<Uri> many = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (many != null) out.addAll(many);
        } catch (Exception ignored) {}

        ClipData clip = intent.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri uri = clip.getItemAt(i).getUri();
                if (uri != null) out.add(uri);
            }
        }

        return out;
    }

    private JSObject readFile(Uri uri) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();

        String type = resolver.getType(uri);
        if (type == null || type.isEmpty()) type = "application/octet-stream";

        String name = safeName(uri);
        long declaredSize = -1;

        try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0 && !cursor.isNull(nameIndex)) {
                    name = cursor.getString(nameIndex);
                }

                int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
                    declaredSize = cursor.getLong(sizeIndex);
                }
            }
        } catch (Exception ignored) {}

        if (declaredSize > MAX_FILE_BYTES) {
            throw new Exception("файл больше 16 МБ");
        }

        byte[] data;

        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) throw new Exception("поток недоступен");

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int total = 0;
            int read;

            while ((read = input.read(chunk)) != -1) {
                total += read;

                if (total > MAX_FILE_BYTES) {
                    throw new Exception("файл больше 16 МБ");
                }

                buffer.write(chunk, 0, read);
            }

            data = buffer.toByteArray();
        }

        JSObject file = new JSObject();
        file.put("name", name);
        file.put("type", type);
        file.put("size", data.length);
        file.put("lastModified", System.currentTimeMillis());
        file.put("dataBase64", Base64.encodeToString(data, Base64.NO_WRAP));
        return file;
    }

    private String safeName(Uri uri) {
        String s = uri == null ? null : uri.getLastPathSegment();
        return (s == null || s.trim().isEmpty()) ? "shared-file" : s;
    }
}
`);

let manifest = fs.readFileSync(manifestFile, "utf8");

if (!manifest.includes('android.intent.action.SEND')) {
  const activityStart = manifest.indexOf("<activity");
  if (activityStart < 0) throw new Error("Main activity not found in AndroidManifest.xml");

  const activityEnd = manifest.indexOf("</activity>", activityStart);
  if (activityEnd < 0) throw new Error("Main activity closing tag not found");

  const filters = `
            <!-- Life RPG native Android Share Target -->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
                <data android:mimeType="image/*" />
                <data android:mimeType="application/json" />
                <data android:mimeType="application/pdf" />
                <data android:mimeType="text/calendar" />
                <data android:mimeType="text/csv" />
                <data android:mimeType="application/vnd.ms-excel" />
                <data android:mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                <data android:mimeType="application/octet-stream" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND_MULTIPLE" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="image/*" />
                <data android:mimeType="application/json" />
                <data android:mimeType="application/pdf" />
                <data android:mimeType="text/calendar" />
                <data android:mimeType="text/csv" />
                <data android:mimeType="application/vnd.ms-excel" />
                <data android:mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                <data android:mimeType="application/octet-stream" />
            </intent-filter>
`;

  manifest =
    manifest.slice(0, activityEnd) +
    filters +
    manifest.slice(activityEnd);

  fs.writeFileSync(manifestFile, manifest);
}

const mainText = fs.readFileSync(mainActivity, "utf8");
const pluginText = fs.readFileSync(pluginFile, "utf8");
const manifestText = fs.readFileSync(manifestFile, "utf8");

const checks = [
  [mainText.includes("captureShareIntent(getIntent())"), "Cold-start Activity share capture missing"],
  [mainText.includes("captureShareIntent(intent)"), "Warm-start Activity share capture missing"],
  [mainText.includes("setIntent(intent)"), "Activity setIntent update missing"],
  [mainText.includes("consumePendingShareIntent"), "Activity pending share consume method missing"],
  [mainText.includes("registerPlugin(NativeSharePlugin.class)"), "NativeShare plugin is not registered"],
  [pluginText.includes('@CapacitorPlugin(name = "NativeShare")'), "NativeSharePlugin annotation missing"],
  [pluginText.includes("MainActivity.consumePendingShareIntent()"), "Plugin is not consuming Activity pending share"],
  [pluginText.includes("void ping"), "NativeShare diagnostic ping missing"],
  [manifestText.includes("android.intent.action.SEND"), "ACTION_SEND manifest filter missing"],
  [manifestText.includes("android.intent.action.SEND_MULTIPLE"), "ACTION_SEND_MULTIPLE manifest filter missing"]
];

for (const [ok, message] of checks) {
  if (!ok) throw new Error(message);
}

console.log("OK — native Android Share Target patched with direct MainActivity capture");
