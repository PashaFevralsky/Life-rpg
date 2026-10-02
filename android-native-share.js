"use strict";
/* Life RPG Android-only native Share bridge.
   NativeShare plugin proxy is bundled from @capacitor/core by GitHub Actions
   into android-native-share-plugin.js and loaded before this file. */
(() => {
  let draining = false;
  let foregroundHooksInstalled = false;
  let nativeListenerInstalled = false;
  let lastDrainAt = 0;

  const D = {
    proxy: "loading",
    ping: "pending",
    pending: "unknown",
    lastDrain: "—",
    lastPayload: "—",
    lastError: "",
    accepted: 0
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function plugin() {
    const p = globalThis.LifeRpgNativeSharePlugin || null;
    D.proxy = p ? "OK" : "NO";
    return p;
  }

  function esc(v) {
    const s = String(v ?? "");
    if (typeof escapeHtml === "function") return escapeHtml(s);
    return s.replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function diagHtml() {
    const good = D.proxy === "OK" && D.ping === "OK";
    return `
      <div id="lifeRpgNativeShareDiag" class="notice" style="margin:10px 0">
        <div class="split">
          <div>
            <b>Android Native Share • ${good ? "BRIDGE OK" : "DIAGNOSTICS"}</b>
            <div class="qmeta">
              JS proxy: ${esc(D.proxy)} • native ping: ${esc(D.ping)} • pending: ${esc(D.pending)}
            </div>
            <div class="qmeta">
              last drain: ${esc(D.lastDrain)} • payload: ${esc(D.lastPayload)} • accepted: ${D.accepted}
            </div>
            ${D.lastError ? `<div class="qmeta">error: ${esc(D.lastError)}</div>` : ""}
          </div>
          <button class="btn ghost small" onclick="LifeRpgAndroidNativeShare.probe()">Проверить bridge</button>
        </div>
      </div>`;
  }

  function renderDiag() {
    const command = document.getElementById("share131Command");
    if (!command) return;

    const card = command.closest(".card");
    if (!card) return;

    const old = document.getElementById("lifeRpgNativeShareDiag");
    if (old) {
      old.outerHTML = diagHtml();
    } else {
      command.insertAdjacentHTML("beforebegin", diagHtml());
    }
  }

  async function waitLifeRpgReady() {
    for (let i = 0; i < 120; i++) {
      if (
        typeof share131QueuePut === "function" &&
        typeof share131AutoRoute === "function" &&
        typeof renderShare131 === "function" &&
        typeof share131CombinedText === "function" &&
        typeof share131HistoryAdd === "function" &&
        typeof uid === "function" &&
        typeof S !== "undefined"
      ) {
        renderDiag();
        return true;
      }
      await sleep(100);
    }
    throw new Error("Life RPG Share Hub не успел загрузиться");
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

  async function probe() {
    const p = plugin();
    if (!p) {
      D.ping = "NO PROXY";
      D.lastError = "android-native-share-plugin.js не создал NativeShare proxy";
      renderDiag();
      return false;
    }

    try {
      const pong = await p.ping();
      D.ping = pong?.ok ? "OK" : "BAD";
      const status = typeof p.getShareStatus === "function" ? await p.getShareStatus() : null;
      D.pending = status?.pending ? `${status.action || "share"} • ${status.type || "?"}` : "empty";
      D.lastError = "";
      renderDiag();
      return pong?.ok === true;
    } catch (e) {
      D.ping = "FAIL";
      D.lastError = String(e?.message || e);
      renderDiag();
      return false;
    }
  }

  async function acceptPayload(payload) {
    if (!payload || payload.empty) return false;

    await waitLifeRpgReady();

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

    if (!row.files.length && !share131CombinedText(row)) {
      D.lastError = "Intent получен, но в нём нет читаемого текста/файла";
      renderDiag();
      return false;
    }

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

    D.accepted += 1;
    D.lastPayload = `${payload.action || "share"} • files ${row.files.length}`;
    D.pending = "consumed";
    D.lastError = "";

    try {
      ux7Go("more", "settings");
    } catch {}

    await renderShare131();
    renderDiag();

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

    const p = plugin();
    D.lastDrain = reason;

    if (!p || typeof p.getPendingShare !== "function") {
      D.lastError = "NativeShare proxy отсутствует или не содержит getPendingShare()";
      renderDiag();
      return false;
    }

    draining = true;
    lastDrainAt = now;

    try {
      const status = typeof p.getShareStatus === "function" ? await p.getShareStatus() : null;
      D.pending = status?.pending ? `${status.action || "share"} • ${status.type || "?"}` : "empty";

      const payload = await p.getPendingShare();
      if (payload?.empty) {
        D.lastPayload = "empty";
        renderDiag();
        return false;
      }

      D.lastPayload = `${payload.action || "share"} • files ${(payload.files || []).length}`;
      renderDiag();
      return await acceptPayload(payload);
    } catch (e) {
      D.lastError = String(e?.message || e);
      console.error("Life RPG NativeShare drain:", reason, e);
      renderDiag();
      try { toast(`Android Share: ${D.lastError}`); } catch {}
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

    const p = plugin();
    if (!p || typeof p.addListener !== "function") {
      D.lastError = "NativeShare.addListener недоступен";
      renderDiag();
      return;
    }

    try {
      await p.addListener("shareAvailable", () => scheduleDrain("native-event"));
      nativeListenerInstalled = true;
    } catch (e) {
      D.lastError = `listener: ${e?.message || e}`;
      renderDiag();
    }
  }

  async function install() {
    await waitLifeRpgReady().catch(() => {});
    await probe();

    installForegroundHooks();
    await installNativeListener();

    scheduleDrain("startup");
    for (const ms of [350, 900, 1800]) {
      setTimeout(() => void drain(`startup-${ms}`), ms);
    }
  }

  globalThis.LifeRpgAndroidNativeShare = {
    drain: () => drain("manual"),
    acceptPayload,
    probe,
    diagnostics: D
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { void install(); }, { once: true });
  } else {
    void install();
  }
})();
