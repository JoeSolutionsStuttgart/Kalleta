/* Füllt Impressum und Datenschutzerklärung aus rechtliches.js. */
(function () {
  var R = window.KALLETA_RECHT || {};
  /* Noch nicht freigegeben: zur App zurück (Vorschau mit ?vorschau). */
  if (R.anzeigen !== true) {
    if (!/[?&]vorschau\b/.test(location.search)) { location.replace("./"); return; }
    var m = document.createElement("meta"); m.name = "robots"; m.content = "noindex, nofollow"; document.head.appendChild(m);
    document.querySelectorAll('a[href="impressum.html"], a[href="datenschutz.html"]').forEach(function (l) { l.href = l.getAttribute("href") + "?vorschau"; });
  }
  var CFG = window.CHRONIK_CONFIG || {};
  var NAME = String(CFG.appName || "Kalleta");
  var W = CFG.werbung || {};
  function leer(k) { return !String(R[k] || "").trim(); }
  function fehlt() { var s = document.createElement("span"); s.className = "fehlt"; s.textContent = "[bitte ausfüllen]"; return s; }
  document.querySelectorAll("[data-app]").forEach(function (el) { el.textContent = NAME; });
  document.querySelectorAll("[data-f]").forEach(function (el) {
    var k = el.getAttribute("data-f");
    var v = String(R[k] || "").trim();
    if (!v) {
      if (el.hasAttribute("data-optional")) { el.remove(); return; }
      el.textContent = ""; el.appendChild(fehlt()); return;
    }
    if (el.hasAttribute("data-mail")) {
      var a = document.createElement("a"); a.href = "mailto:" + v; a.textContent = v; el.textContent = ""; el.appendChild(a);
    } else {
      el.textContent = v;
      if (el.hasAttribute("data-optional")) el.insertAdjacentHTML("afterend", "<br>");
    }
  });
  /* Ganze Abschnitte nur zeigen, wenn es dazu Angaben gibt. */
  document.querySelectorAll("[data-block]").forEach(function (el) { if (leer(el.getAttribute("data-block"))) el.remove(); });
  document.querySelectorAll("[data-zeile]").forEach(function (el) { if (leer(el.getAttribute("data-zeile"))) el.remove(); });
  /* Werbung nur erwähnen, wenn sie mit Google AdSense läuft. */
  var adsense = Number(W.stufe || 0) >= 2 && W.anbieter === "adsense" && !!W.adsenseClient;
  document.querySelectorAll("[data-wenn-werbung]").forEach(function (el) { if (!adsense) el.remove(); });
  document.title = document.title + " · " + NAME;
  /* Cookie-Einstellungen von hier aus ändern. */
  document.querySelectorAll("[data-cookie]").forEach(function (b) {
    b.addEventListener("click", function () {
      try { localStorage.removeItem("kalleta.zustimmung"); } catch (e) { /* egal */ }
      window.location.href = "./";
    });
  });
})();
