import fs from "node:fs";
import path from "node:path";

const cfg = JSON.parse(fs.readFileSync("android-release-config.json", "utf8"));
const meta = JSON.parse(fs.readFileSync("android-release-meta.json", "utf8"));
const cap = JSON.parse(fs.readFileSync("capacitor.config.json", "utf8"));
const appId = String(cap.appId || "").trim();
if (!appId) throw new Error("capacitor.config.json appId missing");

const gradlePath = path.join("android", "app", "build.gradle");
let gradle = fs.readFileSync(gradlePath, "utf8");
if (!/versionCode\s+\d+/.test(gradle)) throw new Error("versionCode not found");
if (!/versionName\s+"[^"]+"/.test(gradle)) throw new Error("versionName not found");
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${meta.versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${meta.versionName}"`);
fs.writeFileSync(gradlePath, gradle);

const javaDir = path.join("android", "app", "src", "main", "java", ...appId.split("."));
const mainActivity = path.join(javaDir, "MainActivity.java");
fs.mkdirSync(javaDir, { recursive:true });

fs.writeFileSync(mainActivity, `package ${appId};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        refreshBundledWebAssets();
    }

    private void refreshBundledWebAssets() {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        getBridge().getWebView().postDelayed(() -> {
            try {
                String versionName = getPackageManager()
                    .getPackageInfo(getPackageName(), 0)
                    .versionName;
                String marker = "life-rpg-android-assets-" + versionName;

                String js =
                    "(async()=>{" +
                    "const k=" + org.json.JSONObject.quote(marker) + ";" +
                    "if(localStorage.getItem(k)==='1')return;" +
                    "try{" +
                    "if('serviceWorker' in navigator){" +
                    "const rs=await navigator.serviceWorker.getRegistrations();" +
                    "await Promise.all(rs.map(r=>r.unregister()));" +
                    "}" +
                    "if('caches' in globalThis){" +
                    "const ks=await caches.keys();" +
                    "await Promise.all(ks.map(x=>caches.delete(x)));" +
                    "}" +
                    "}finally{" +
                    "localStorage.setItem(k,'1');" +
                    "location.reload();" +
                    "}" +
                    "})().catch(e=>console.error('Life RPG Android asset refresh',e));";

                getBridge().getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {
            }
        }, 1200);
    }
}
`);

const manifestPath = path.join("android", "app", "src", "main", "AndroidManifest.xml");
const manifest = fs.readFileSync(manifestPath, "utf8");
if (manifest.includes("android.intent.action.SEND") || manifest.includes("android.intent.action.SEND_MULTIPLE")) {
  throw new Error("Native Android Share filters must not exist in RC");
}
if (fs.existsSync(path.join(javaDir, "NativeSharePlugin.java"))) {
  throw new Error("NativeSharePlugin.java must not exist in RC");
}

console.log(`OK — patched Android RC shell ${meta.versionName} / ${meta.versionCode}`);
