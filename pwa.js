/* GYMORA — "Install app" prompt (free Add-to-Home-Screen install).
   Android/desktop Chrome: real one-tap install via beforeinstallprompt.
   iPhone/iPad: short "Share → Add to Home Screen" instruction.
   No service worker on purpose — updates stay instant on every deploy. */
(function () {
  "use strict";

  var SNOOZE_KEY = "gym_pwa_snooze";
  var DONE_KEY = "gym_pwa_installed";
  var SNOOZE_DAYS = 14;

  // Already running as an installed app → nothing to do.
  var standalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  if (standalone) { try { localStorage.setItem(DONE_KEY, "1"); } catch (e) {} return; }

  try {
    if (localStorage.getItem(DONE_KEY)) return;
    var snoozed = +localStorage.getItem(SNOOZE_KEY) || 0;
    if (Date.now() - snoozed < SNOOZE_DAYS * 86400000) return;
  } catch (e) {}

  var ua = navigator.userAgent || "";
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  var deferredPrompt = null;

  var TXT = {
    en: {
      title: "Get the GYMORA app",
      android: "Install GYMORA on your phone — free, full-screen, right on your home screen.",
      ios: "Tap the Share button <b>&#x2191;</b> below, then <b>“Add to Home Screen”</b> — free, no App Store needed.",
      install: "Install",
      later: "Not now"
    },
    ar: {
      title: "ثبّت تطبيق GYMORA",
      android: "ثبّت GYMORA على هاتفك — مجاناً وبشاشة كاملة من شاشتك الرئيسية.",
      ios: "اضغط زر المشاركة <b>&#x2191;</b> بالأسفل ثم <b>«إضافة إلى الشاشة الرئيسية»</b> — مجاناً وبدون متجر التطبيقات.",
      install: "تثبيت",
      later: "ليس الآن"
    }
  };
  function lang() {
    var l = "en";
    try { l = localStorage.getItem("fj_lang") || document.documentElement.lang || "en"; } catch (e) {}
    return TXT[l] ? l : "en";
  }

  function injectCSS() {
    if (document.getElementById("pwaCSS")) return;
    var css = document.createElement("style");
    css.id = "pwaCSS";
    css.textContent =
      ".pwa-banner{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:80;" +
      "display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--radius,16px);" +
      "background:var(--surface,#141414);color:var(--text,#f2f4f2);border:1px solid var(--border,#262a27);" +
      "box-shadow:var(--shadow,0 6px 24px rgba(0,0,0,.45));max-width:520px;margin-inline:auto;" +
      "transform:translateY(120%);transition:transform .35s cubic-bezier(.2,.8,.25,1)}" +
      ".pwa-banner.show{transform:translateY(0)}" +
      ".pwa-banner img{width:44px;height:44px;border-radius:11px;flex:none}" +
      ".pwa-txt{flex:1;min-width:0}" +
      ".pwa-txt h4{margin:0 0 2px;font-size:14.5px}" +
      ".pwa-txt p{margin:0;font-size:12.5px;line-height:1.45;color:var(--muted,#9aa39e)}" +
      ".pwa-txt p b{color:var(--accent,#22c55e)}" +
      ".pwa-actions{display:flex;flex-direction:column;gap:6px;flex:none}" +
      ".pwa-install{border:0;border-radius:10px;padding:8px 14px;font-weight:700;font-size:13px;cursor:pointer;" +
      "background:var(--accent-grad,linear-gradient(120deg,#16a34a,#4ade80));color:#04160a}" +
      ".pwa-later{border:0;background:none;color:var(--muted,#9aa39e);font-size:12px;cursor:pointer;padding:2px}";
    document.head.appendChild(css);
  }

  function dismiss(el) {
    el.classList.remove("show");
    setTimeout(function () { el.remove(); }, 400);
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch (e) {}
  }

  function showBanner() {
    if (document.getElementById("pwaBanner")) return;
    injectCSS();
    var T = TXT[lang()];
    var el = document.createElement("div");
    el.className = "pwa-banner";
    el.id = "pwaBanner";
    el.setAttribute("role", "dialog");
    el.innerHTML =
      '<img src="icon-192.png" alt="" />' +
      '<div class="pwa-txt"><h4>' + T.title + "</h4><p>" +
      (isIOS ? T.ios : T.android) + "</p></div>" +
      '<div class="pwa-actions">' +
      (isIOS ? "" : '<button class="pwa-install" id="pwaInstall">' + T.install + "</button>") +
      '<button class="pwa-later" id="pwaLater">' + T.later + "</button></div>";
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add("show"); }, 50);

    var btn = document.getElementById("pwaInstall");
    if (btn) btn.addEventListener("click", function () {
      if (!deferredPrompt) { dismiss(el); return; }
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (r) {
        if (r && r.outcome === "accepted") {
          try { localStorage.setItem(DONE_KEY, "1"); } catch (e) {}
        }
        dismiss(el);
      });
      deferredPrompt = null;
    });
    document.getElementById("pwaLater").addEventListener("click", function () { dismiss(el); });
  }

  // Wait until the onboarding wizard (if any) is closed, then show.
  function whenReady(fn) {
    var tries = 0;
    (function poll() {
      if (!document.getElementById("obBack")) return fn();
      if (++tries > 150) return; // give up after ~5 min
      setTimeout(poll, 2000);
    })();
  }

  window.addEventListener("appinstalled", function () {
    try { localStorage.setItem(DONE_KEY, "1"); } catch (e) {}
    var el = document.getElementById("pwaBanner");
    if (el) el.remove();
  });

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(function () { whenReady(showBanner); }, 6000);
  });

  if (isIOS) {
    window.addEventListener("load", function () {
      setTimeout(function () { whenReady(showBanner); }, 6000);
    });
  }
})();
