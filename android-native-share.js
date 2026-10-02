"use strict";
/* Life RPG Android-only native Share bridge — warm-start hardened.
   Injected into the Capacitor APK by android-beta.yml.
   GitHub Pages/PWA is intentionally unchanged. */
(() => {
  let draining = false;
  let listenerInstalled = false;
  let foregroundHooksInstalled = false;
  let lastDrainAt = 0;

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

  function nativeCall(method, options = {}) {
    const cap = globalThis.Capacitor;
    if (!cap) return Promise.reject(new Error("Capacitor runtime недоступен"));

    /* Direct nativePromise is the most reliable path for a local native plugin.
       It does not depend on a generated JS proxy being present. */
    if (typeof cap.nativePromise === "function") {
      return cap.nativePromise("NativeShare", method, options);
    }

    const p = cap.Plugins?.NativeShare;
    if (p && typeof p[method] === "function") return p[method](options);

    return Promise.reject(new Error("NativeShare plugin недоступен"));
  }

  function nativePluginProxy() {
    return globalThis.Capacitor?.Plugins?.NativeShare || null;
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

  async function drain(reason = "manual") {
    const now = Date.now();
    if (draining) return false;

    /* Foreground events can fire in a burst; coalesce them. */
    if (reason !== "manual" && now - lastDrainAt < 180) return false;

    draining = true;
    lastDrainAt = now;
    try {
      const payload = await nativeCall("getPendingShare", {});
      return await acceptPayload(payload);
    } catch (e) {
      const msg = String(e?.message || e);
      /* Missing pending intent is not an error worth surfacing. */
      if (!/plugin недоступен|runtime недоступен/i.test(msg)) {
        console.error("Life RPG native share:", e);
      }
      return false;
    } finally {
      draining = false;
    }
  }

  function scheduleForegroundDrain(reason) {
    void drain(reason);
    /* Android can deliver onNewIntent just after focus/visibility changes.
       Retry briefly so the pending Intent cannot be missed by ordering races. */
    setTimeout(() => void drain(`${reason}-250`), 250);
    setTimeout(() => void drain(`${reason}-750`), 750);
  }

  function installForegroundHooks() {
    if (foregroundHooksInstalled) return;
    foregroundHooksInstalled = true;

    globalThis.addEventListener("focus", () => scheduleForegroundDrain("focus"));

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scheduleForegroundDrain("visible");
      }
    });

    /* Capacitor bridge dispatches resume on document in supported builds. */
    document.addEventListener("resume", () => scheduleForegroundDrain("resume"));

    globalThis.addEventListener("pageshow", () => scheduleForegroundDrain("pageshow"));
  }

  function installNativeListener() {
    if (listenerInstalled) return;
    listenerInstalled = true;

    try {
      const p = nativePluginProxy();
      if (p?.addListener) {
        const ret = p.addListener("shareAvailable", () => scheduleForegroundDrain("native-event"));
        if (ret?.catch) ret.catch(() => {});
      }
    } catch {}
  }

  async function install() {
    installForegroundHooks();
    installNativeListener();

    /* Cold start / already pending share. */
    scheduleForegroundDrain("startup");

    /* One short startup sweep also covers very early plugin registration races. */
    for (const ms of [400, 1000, 2000]) {
      setTimeout(() => void drain(`startup-${ms}`), ms);
    }
  }

  globalThis.LifeRpgAndroidNativeShare = {
    drain: () => drain("manual"),
    acceptPayload
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { void install(); }, { once: true });
  } else {
    void install();
  }
})();
