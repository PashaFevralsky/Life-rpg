"use strict";
/* Life RPG Android-only native Share bridge.
   Injected into the Capacitor APK by android-beta.yml.
   GitHub Pages/PWA is intentionally unchanged. */
(() => {
  let draining = false;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitLifeRpgReady() {
    for (let i = 0; i < 120; i++) {
      if (
        typeof share131QueuePut === "function" &&
        typeof share131AutoRoute === "function" &&
        typeof renderShare131 === "function" &&
        typeof uid === "function" &&
        typeof S !== "undefined"
      ) return true;
      await sleep(100);
    }
    return false;
  }

  function plugin() {
    const cap = globalThis.Capacitor;
    if (!cap) return null;
    if (cap.Plugins?.NativeShare) return cap.Plugins.NativeShare;
    if (typeof cap.nativePromise === "function") {
      return {
        getPendingShare: () => cap.nativePromise("NativeShare", "getPendingShare", {}),
        addListener: (eventName, callback) => cap.addListener?.("NativeShare", eventName, callback)
      };
    }
    return null;
  }

  function base64File(row) {
    const raw = atob(String(row?.dataBase64 || ""));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new File(
      [bytes],
      String(row?.name || `shared-${Date.now()}`),
      {
        type: String(row?.type || "application/octet-stream"),
        lastModified: Number(row?.lastModified) || Date.now()
      }
    );
  }

  async function acceptPayload(payload) {
    if (!payload || payload.empty) return false;
    if (!(await waitLifeRpgReady())) throw new Error("Life RPG Share Hub не успел загрузиться");

    const files = [];
    for (const item of payload.files || []) {
      try {
        if (item?.dataBase64) files.push(base64File(item));
      } catch (e) {
        (payload.errors ||= []).push(`Файл ${item?.name || ""}: ${e?.message || e}`);
      }
    }

    const row = {
      id: uid(),
      receivedAt: new Date().toISOString(),
      source: "android-share",
      title: String(payload.title || "Android Share"),
      text: String(payload.text || ""),
      url: String(payload.url || ""),
      files: files.map(f => ({
        name: f.name || `shared-${Date.now()}`,
        type: f.type || "application/octet-stream",
        size: f.size || 0,
        lastModified: f.lastModified || Date.now(),
        blob: f
      })),
      errors: Array.isArray(payload.errors) ? payload.errors.map(String) : [],
      status: "queued",
      routedAt: ""
    };

    if (!row.files.length && !share131CombinedText(row)) return false;

    await share131QueuePut(row);

    if (!(typeof storageSafeModeActive === "function" && storageSafeModeActive())) {
      const before = typeof deepClone === "function" ? deepClone(S) : null;
      share131HistoryAdd({
        status: "received",
        route: share131Classify(row),
        name: row.files[0]?.name || row.title || "Android Share",
        detail: `${row.files.length ? `${row.files.length} файл(а)` : "текст"} • native Android`
      });
      if (before && typeof persistPreparedStateAtomically === "function") {
        await persistPreparedStateAtomically(before);
      } else if (typeof persist === "function") {
        await persist();
      }
    }

    try {
      ux7Go("more", "settings");
    } catch {}

    await renderShare131();
    await share131AutoRoute(row);

    setTimeout(() => {
      try {
        document.getElementById("share131Command")
          ?.closest(".card")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {}
    }, 180);

    return true;
  }

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      const p = plugin();
      if (!p?.getPendingShare) return;
      const payload = await p.getPendingShare();
      await acceptPayload(payload);
    } catch (e) {
      console.error("Life RPG native share:", e);
      try { toast(`Android Share: ${e?.message || e}`); } catch {}
    } finally {
      draining = false;
    }
  }

  async function install() {
    const p = plugin();
    if (!p) return;
    try {
      const listener = p.addListener?.("shareAvailable", () => { void drain(); });
      if (listener?.catch) listener.catch(() => {});
    } catch {}
    await drain();
  }

  globalThis.LifeRpgAndroidNativeShare = { drain, acceptPayload };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { void install(); }, { once: true });
  } else {
    void install();
  }
})();
