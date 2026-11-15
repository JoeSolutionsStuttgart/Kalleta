/* ============================================================
   KALLETA — Zustimmung (Cookie-Fenster) und anonyme Nutzungsstatistik
   · Fragt beim ersten Besuch in einem Fenster, was gespeichert werden darf.
   · Notwendiges (Anmeldung, Sprache, Design, diese Entscheidung) läuft immer.
   · Statistik: nur mit Zustimmung. Es werden nur Zähler pro Tag an die
     eigene Datenbank geschickt (supabase-update-41.sql) — keine IP,
     keine Konten, keine Kennung des Geräts.
   · Werbung: nur, wenn Werbung mit Google AdSense eingeschaltet ist.
   Öffentlich: window.KalletaNutzung = { oeffnen, erlaubt, zaehle, zustand }
   ============================================================ */
(function () {
  /* Nur im Hauptfenster (nicht in eingebetteten Hilfsfenstern), sonst doppelt gezählt. */
  try { if (window.top !== window.self) return; } catch (e) { return; }
  /* Nur einmal pro Seite laden (die Laufzeit kann Skripte erneut einsetzen). */
  if (window.KalletaNutzung) return;
  var CFG = window.CHRONIK_CONFIG || {};
  var W = CFG.werbung || {};
  var KEY = "kalleta.zustimmung";
  var VERSION = 1;
  var TAGKEY = "kalleta.nutzung.tag";
  var ERSTKEY = "kalleta.nutzung.erst";
  var t = function (k, d) { try { var v = window.tx ? window.tx(k) : k; return v && v !== k ? v : d; } catch (e) { return d; } };
  var werbungFragen = Number(W.stufe || 0) >= 2 && (W.anbieter === "adsense") && !!W.adsenseClient && W.zustimmungFragen !== false;

  function lesen() {
    try { var z = JSON.parse(localStorage.getItem(KEY) || "null"); return z && z.v === VERSION ? z : null; } catch (e) { return null; }
  }
  var wahl = lesen();
  function speichern(statistik, werbung) {
    wahl = { v: VERSION, notwendig: true, statistik: !!statistik, werbung: !!werbung, zeit: new Date().toISOString() };
    try { localStorage.setItem(KEY, JSON.stringify(wahl)); } catch (e) { /* ohne Speicher gilt die Wahl nur jetzt */ }
    /* Mit der Werbe-Leiste aus cw-plaetze.js abgleichen. */
    try { localStorage.setItem("cw_zust", wahl.werbung ? "ja" : "nein"); } catch (e) { /* egal */ }
    if (!wahl.statistik) {
      puffer = {};
      try { localStorage.removeItem(TAGKEY); localStorage.removeItem(ERSTKEY); } catch (e) { /* egal */ }
    } else {
      grundZaehlen();
      senden(false);
    }
    try { window.dispatchEvent(new CustomEvent("kalleta-zustimmung", { detail: wahl })); } catch (e) { /* alt */ }
  }
  function erlaubt(art) { return art === "notwendig" || !!(wahl && wahl[art]); }

  /* ---------- Fenster ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var vorFokus = null;
  function oeffnen() {
    if (!document.body) { document.addEventListener("DOMContentLoaded", oeffnen); return; }
    if (document.getElementById("kz-fenster")) return;
    vorFokus = document.activeElement;
    var z = wahl || { statistik: false, werbung: false };
    var hg = document.createElement("div");
    hg.id = "kz-fenster"; hg.setAttribute("data-noprint", "");
    hg.setAttribute("style", "position:fixed;inset:0;z-index:5000;display:grid;place-items:center;padding:16px;box-sizing:border-box;background:rgba(20,18,16,.45);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);overflow:auto;");
    var zeile = function (id, titel, text, an, fest) {
      return '<label style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:start;padding:12px 0;border-top:1px solid var(--color-divider,#d9d6d3);cursor:' + (fest ? "default" : "pointer") + ';">' +
        '<input type="checkbox" id="' + id + '"' + (an ? " checked" : "") + (fest ? " disabled" : "") + ' style="width:20px;height:20px;margin:2px 0 0;accent-color:var(--color-accent,#0b88a8);">' +
        '<span style="font-weight:700;">' + esc(titel) + (fest ? ' <span style="font-weight:400;font-size:12px;color:var(--color-neutral-700,#5d5a58);">· ' + esc(t("zs_immer", "immer aktiv")) + "</span>" : "") + "</span>" +
        '<span></span><span style="font-size:13.5px;color:var(--color-neutral-700,#5d5a58);line-height:1.45;">' + esc(text) + "</span></label>";
    };
    hg.innerHTML =
      '<div role="dialog" aria-modal="true" aria-labelledby="kz-titel" style="width:100%;max-width:560px;box-sizing:border-box;background:var(--color-bg,#f3f2f2);color:var(--color-text,#201e1d);border:1px solid var(--color-divider,#d9d6d3);border-radius:var(--radius-md,4px);box-shadow:0 18px 60px rgba(0,0,0,.28);padding:22px 22px 18px;font-family:var(--font-body,serif);font-size:15px;line-height:1.5;">' +
        '<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--color-accent-700,#005f7c);margin-bottom:6px;">' + esc(t("zs_kicker", "Datenschutz")) + "</div>" +
        '<h2 id="kz-titel" style="margin:0 0 8px;font-size:22px;line-height:1.2;">' + esc(t("zs_titel", "Darf Kalleta Daten auf deinem Gerät speichern?")) + "</h2>" +
        '<p style="margin:0 0 10px;">' + esc(t("zs_text", "Notwendiges speichern wir immer, damit Anmeldung, Sprache und Design funktionieren. Alles andere nur, wenn du zustimmst. Du kannst deine Wahl jederzeit unten auf der Seite unter „Cookie-Einstellungen“ ändern.")) + "</p>" +
        zeile("kz-notwendig", t("zs_notwendig", "Notwendig"), t("zs_notwendig_t", "Anmeldung, Spracheinstellung, Design und diese Entscheidung. Ohne geht die Seite nicht."), true, true) +
        zeile("kz-statistik", t("zs_statistik", "Statistik"), t("zs_statistik_t", "Anonyme Zähler, wie Kalleta genutzt wird (z. B. Aufrufe, Gerätetyp, genutzte Funktionen). Keine IP-Adresse, kein Profil, keine Weitergabe an Dritte."), !!z.statistik, false) +
        (werbungFragen ? zeile("kz-werbung", t("zs_werbung", "Werbung"), t("zs_werbung_t", "Google AdSense darf Cookies setzen und personalisierte Anzeigen zeigen. Daten gehen dabei an Google."), !!z.werbung, false) : "") +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;">' +
          '<button type="button" data-kz="nein" class="btn btn-primary" style="min-height:46px;justify-content:center;">' + esc(t("zs_nur_notwendig", "Nur notwendige")) + "</button>" +
          '<button type="button" data-kz="alle" class="btn btn-primary" style="min-height:46px;justify-content:center;">' + esc(t("zs_alle", "Alle akzeptieren")) + "</button>" +
        "</div>" +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;">' +
          '<button type="button" data-kz="auswahl" class="btn btn-secondary" style="min-height:42px;">' + esc(t("zs_auswahl", "Auswahl speichern")) + "</button>" +
          '<span style="font-size:13px;display:flex;gap:14px;"><a href="impressum.html" target="_blank" rel="noopener" style="color:var(--color-accent-700,#005f7c);">' + esc(t("zs_impressum", "Impressum")) + '</a><a href="datenschutz.html" target="_blank" rel="noopener" style="color:var(--color-accent-700,#005f7c);">' + esc(t("zs_datenschutz", "Datenschutz")) + "</a></span>" +
        "</div>" +
      "</div>";
    hg.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest("[data-kz]") : null;
      if (!b) return;
      var w = b.getAttribute("data-kz");
      if (w === "alle") speichern(true, werbungFragen);
      else if (w === "nein") speichern(false, false);
      else {
        var s = document.getElementById("kz-statistik"), r = document.getElementById("kz-werbung");
        speichern(!!(s && s.checked), !!(r && r.checked));
      }
      schliessen();
    });
    hg.addEventListener("keydown", function (ev) {
      if (ev.key !== "Tab") return;
      var f = hg.querySelectorAll("button, a, input:not([disabled])");
      if (!f.length) return;
      var a = f[0], e = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); e.focus(); }
      else if (!ev.shiftKey && document.activeElement === e) { ev.preventDefault(); a.focus(); }
    });
    document.body.appendChild(hg);
    try { hg.querySelector('[data-kz="nein"]').focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }
  function schliessen() {
    var d = document.getElementById("kz-fenster");
    if (d) d.remove();
    try { if (vorFokus && vorFokus.focus) vorFokus.focus({ preventScroll: true }); } catch (e) { /* egal */ }
  }

  /* ---------- Fußleiste: Impressum · Datenschutz · Cookie-Einstellungen ---------- */
  function fussleiste() {
    if (!document.body || document.getElementById("kz-fuss")) return;
    var f = document.createElement("div");
    f.id = "kz-fuss"; f.setAttribute("data-noprint", "");
    f.setAttribute("style", "display:flex;justify-content:center;flex-wrap:wrap;gap:6px 18px;padding:18px 16px calc(18px + env(safe-area-inset-bottom));font-family:var(--font-body,serif);font-size:12.5px;color:var(--color-neutral-700,#5d5a58);");
    var a = "color:inherit;text-decoration:underline;text-underline-offset:2px;";
    f.innerHTML = '<a href="impressum.html" style="' + a + '">' + esc(t("zs_impressum", "Impressum")) + "</a>" +
      '<a href="datenschutz.html" style="' + a + '">' + esc(t("zs_datenschutz", "Datenschutz")) + "</a>" +
      '<button type="button" style="' + a + 'font:inherit;background:none;border:0;padding:0;cursor:pointer;">' + esc(t("zs_einstellungen", "Cookie-Einstellungen")) + "</button>";
    f.querySelector("button").addEventListener("click", oeffnen);
    document.body.appendChild(f);
  }

  /* ---------- Zählen ---------- */
  var puffer = {};
  var aus = false;          // Funktion fehlt in der Datenbank → still bleiben
  var gesendetDauer = false;
  var start = Date.now();
  function sauber(k) { return String(k || "").toLowerCase().replace(/[^a-z0-9:_.-]+/g, "_").slice(0, 60); }
  function zaehle(k, n) {
    k = sauber(k);
    if (!k) return;
    if (wahl && !wahl.statistik) return;
    puffer[k] = Math.min(200, (puffer[k] || 0) + (n || 1));
  }
  function apiUrl() {
    var url = String(CFG.url || "").trim().replace(/\/+$/, "").replace(/\/(rest|auth|storage|realtime)\/v1.*$/i, "");
    if (!url) return "";
    if (!/^https?:\/\//.test(url)) url = "https://" + url;
    return url + "/rest/v1/rpc/nutzung_zaehlen";
  }
  function senden(zumSchluss) {
    if (aus || !erlaubt("statistik")) return;
    var ks = Object.keys(puffer);
    if (!ks.length) return;
    var url = apiUrl(), key = String(CFG.anonKey || "").trim().replace(/^["']|["']$/g, "");
    if (!url || !key) return;
    var teil = {}; ks.slice(0, 40).forEach(function (k) { teil[k] = puffer[k]; delete puffer[k]; });
    try {
      fetch(url, { method: "POST", keepalive: !!zumSchluss, headers: { "Content-Type": "application/json", apikey: key, Authorization: "Bearer " + key },
        body: JSON.stringify({ p_daten: teil }) })
        .then(function (r) { if (r.status === 404) aus = true; })
        .catch(function () { if (!zumSchluss) Object.keys(teil).forEach(function (k) { puffer[k] = Math.min(200, (puffer[k] || 0) + teil[k]); }); });
    } catch (e) { /* ohne Netz */ }
    if (Object.keys(puffer).length && !zumSchluss) window.setTimeout(function () { senden(false); }, 2000);
  }

  var grundGezaehlt = false;
  function grundZaehlen() {
    if (grundGezaehlt) return;
    grundGezaehlt = true;
    var w = window.innerWidth || 1280;
    var ua = navigator.userAgent || "";
    zaehle("aufruf");
    zaehle("geraet:" + (w < 760 ? "mobil" : w < 1100 ? "tablet" : "desktop"));
    zaehle("sprache:" + (window.CHRONIK_SPRACHE || "de"));
    zaehle("bereich:" + (/^#gast=/.test(location.hash || "") ? "gast" : "app"));
    zaehle("browser:" + (/Edg\//.test(ua) ? "edge" : /OPR\//.test(ua) ? "opera" : /Firefox\//.test(ua) ? "firefox" : /Chrome\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "andere"));
    zaehle("system:" + (/iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : /Windows/.test(ua) ? "windows" : /Mac OS X/.test(ua) ? "macos" : /Linux/.test(ua) ? "linux" : "andere"));
    try { if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) zaehle("installiert"); } catch (e) { /* egal */ }
    try {
      var r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "";
      if (r && r !== location.hostname.replace(/^www\./, "")) zaehle("herkunft:" + r);
      else if (!r) zaehle("herkunft:direkt");
    } catch (e) { /* egal */ }
    try {
      var heute = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(TAGKEY) !== heute) { localStorage.setItem(TAGKEY, heute); zaehle("besucher"); }
      if (!localStorage.getItem(ERSTKEY)) { localStorage.setItem(ERSTKEY, heute); zaehle("besucher_neu"); }
    } catch (e) { /* egal */ }
  }

  function dauerZaehlen() {
    if (gesendetDauer) return;
    gesendetDauer = true;
    var m = (Date.now() - start) / 60000;
    zaehle("dauer:" + (m < 1 ? "0-1" : m < 5 ? "1-5" : m < 15 ? "5-15" : m < 60 ? "15-60" : "60plus"));
  }

  /* Bereiche, die in der App geöffnet werden (aus componentDidUpdate). */
  var OFFEN = { drawer: "bearbeiten_menue", admin: "kontakte", konto: "konto", vgl: "vergleich", filterOffen: "filter", quiz: "quiz", ass: "assistent",
    tour: "leitfaden", menuOffen: "menue", ueberMich: "ueber_mich", kontaktSicht: "kontakt_zeitleiste", editing: "ereignis_bearbeiten", einstSeite: "einstellungen", openVoll: "ereignis_ansehen" };
  function zustand(vor, nach) {
    if (!vor || !nach || (wahl && !wahl.statistik)) return;
    Object.keys(OFFEN).forEach(function (k) { if (!vor[k] && nach[k]) zaehle("offen:" + OFFEN[k]); });
    if (!(vor.show && vor.show.open) && nach.show && nach.show.open) zaehle("offen:fotoshow");
    if (vor.mode !== nach.mode && nach.mode) zaehle("ansicht:" + nach.mode);
    if (!vor.session && nach.session) zaehle("angemeldet");
    if (vor.themeId !== nach.themeId && nach.themeId && vor.themeId != null) zaehle("design:" + nach.themeId);
  }

  /* Aktionen: Aufrufe der Datenbank-Brücke mitzählen (nur die Namen). */
  var AKTION = { signUp: "registriert", signIn: "anmeldung", saveEvent: "ereignis_gespeichert", removeEvent: "ereignis_geloescht", addComment: "kommentar",
    uploadImage: "bild_hochgeladen", gastAdd: "gast_antwort", gastUpload: "gast_bild", askFriend: "kontakt_anfrage", answerFriend: "kontakt_antwort",
    saveGroup: "gruppe", finSetzen: "finanzen", finAbschluss: "finanzen_abschluss", spielGeheimSetzen: "auslosung", setPolls: "umfrage", reactComment: "reaktion",
    feedbackSenden: "feedback", deleteMe: "konto_geloescht", ttKi: "ki_plakat", sendReset: "passwort_vergessen" };
  function bruecke() {
    var C = window.ChronikCloud;
    if (!C || C.__gezaehlt) return;
    C.__gezaehlt = true;
    Object.keys(AKTION).forEach(function (k) {
      var f = C[k];
      if (typeof f !== "function") return;
      C[k] = function () { zaehle("aktion:" + AKTION[k]); return f.apply(this, arguments); };
    });
  }

  window.KalletaNutzung = { oeffnen: oeffnen, erlaubt: erlaubt, zaehle: zaehle, zustand: zustand, wahl: function () { return wahl; } };

  function los() {
    bruecke();
    fussleiste();
    if (!wahl) oeffnen();
    else if (wahl.statistik) grundZaehlen();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", los); else los();
  window.setInterval(function () { senden(false); }, 60000);
  window.setTimeout(function () { senden(false); }, 8000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { dauerZaehlen(); senden(true); } });
  window.addEventListener("pagehide", function () { dauerZaehlen(); senden(true); });
})();
