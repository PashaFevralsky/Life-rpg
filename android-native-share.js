"use strict";
/* Life RPG Android-only native Share bridge — Capacitor plugin proxy registered.
   Injected only into the Android APK by android-beta.yml.
   GitHub Pages/PWA remains unchanged. */
(() => {
  let draining = false;
  let nativeShare = null;
  let foregroundHooksInstalled = false;
  let nativeListenerInstalled = false;
  let lastDrainAt = 0;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function getNativeShare() {
    if (nativeShare) return nativeShare;

    const cap = globalThis.Capacitor;
    if (!cap || typeof cap.registerPlugin !== "function") return null;

    /* Required JS-side registration for a local Capacitor native plugin. */
    nativeShare = cap.registerPlugin("NativeShare");
    return nativeShare;
  }

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

    if (!(await waitLifeRpgReady())) {
      throw new Error("Life RPG Share Hub не успел загрузиться");
    }

    const files = [];
    const payloadErrors = Array.isArray(payload.errors) ? payload.errors.map(String) : [];

    for (const item of payload.files || []) {
      try {
        if (item?.dataBase64) files.push(base64File(item));
      } catch (e) {
        payloadErrors.push(`Файл ${item?.name || ""}: ${e?.message || e}`);
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
      errors: payloadErrors,
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

    /* Keep existing Life RPG routing rules:
       image -> finance/Huawei route,
       import docs -> Import Hub,
       ICS -> calendar,
       text -> Inbox. */
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
    if (reason !== "manual" && now - lastDrainAt < 150) return false;

    const p = getNativeShare();
    if (!p || typeof p.getPendingShare !== "function") return false;

    draining = true;
    lastDrainAt = now;

    try {
      const payload = await p.getPendingShare();
      return await acceptPayload(payload);
    } catch (e) {
      console.error("Life RPG NativeShare drain:", reason, e);
      try {
        toast(`Android Share: ${e?.message || e}`);
      } catch {}
      return false;
    } finally {
      draining = false;
    }
  }

  function scheduleDrain(reason) {
    void drain(reason);
    setTimeout(() => void drain(`${reason}-250`), 250);
    setTimeout(() => void drain(`${reason}-800`), 800);
  }

  function installForegroundHooks() {
    if (foregroundHooksInstalled) return;
    foregroundHooksInstalled = true;

    globalThis.addEventListener("focus", () => scheduleDrain("focus"));

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") scheduleDrain("visible");
    });

    document.addEventListener("resume", () => scheduleDrain("resume"));
    globalThis.addEventListener("pageshow", () => scheduleDrain("pageshow"));
  }

  async function installNativeListener() {
    if (nativeListenerInstalled) return;
    const p = getNativeShare();
    if (!p || typeof p.addListener !== "function") return;

    nativeListenerInstalled = true;
    try {
      await p.addListener("shareAvailable", () => scheduleDrain("native-event"));
    } catch (e) {
      nativeListenerInstalled = false;
      console.error("Life RPG NativeShare listener:", e);
    }
  }

  async function install() {
    const cap = globalThis.Capacitor;
    if (!cap) return;

    const p = getNativeShare();
    if (!p) return;

    installForegroundHooks();
    await installNativeListener();

    /* Cold start and early bridge timing coverage. */
    scheduleDrain("startup");
    for (const ms of [350, 900, 1800]) {
      setTimeout(() => void drain(`startup-${ms}`), ms);
    }
  }

  globalThis.LifeRpgAndroidNativeShare = {
    drain: () => drain("manual"),
    acceptPayload,
    getNativeShare
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { void install(); }, { once: true });
  } else {
    void install();
  }
})();
