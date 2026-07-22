/* =============================================================
   GYMORA — live design layer
   The look of the app is a document, not code: colours, sizes,
   spacing, wording and hidden bits are published from the admin
   console ("Design studio") and applied here on top of styles.css.

   Shape of the design document:
   {
     tokens: { light: {accent,bg,surface,text,…}, dark: {…} },
     rules:  [ { sel: ".btn", css: { "border-radius": "4px" } } ],
     texts:  [ { sel: "#heroTitle", text: "Find your gym" } ],
     hidden: [ ".fab-checkin" ],
     css:    "…free-form CSS as a string…"
   }

   The last published version is cached in this browser and applied
   before the first paint, so there is no flash of the old design.
   Loaded from <head> — keep it dependency-free.
   ============================================================= */

(function () {
  const CACHE_KEY = "gym_design";
  const TOKEN_VARS = {
    accent: "--accent", accent2: "--accent-2", bg: "--bg", surface: "--surface",
    surface2: "--surface-2", text: "--text", muted: "--muted", border: "--border",
    radius: "--radius", shadow: "--shadow",
  };

  let doc = null;
  let applyingText = false;
  let observer = null;

  const clean = (s) => String(s == null ? "" : s).replace(/[{}<>]/g, "").trim();
  const cleanVal = (s) => String(s == null ? "" : s).replace(/[{}<>;]/g, "").trim();

  function styleEl() {
    let el = document.getElementById("gymoraDesignCSS");
    if (!el) {
      el = document.createElement("style");
      el.id = "gymoraDesignCSS";
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  function tokenBlock(selector, tokens) {
    if (!tokens) return "";
    const lines = Object.keys(tokens)
      .filter(k => TOKEN_VARS[k] && tokens[k])
      .map(k => `  ${TOKEN_VARS[k]}: ${cleanVal(tokens[k])};`);
    if (tokens.fontScale) lines.push(`  --font-scale: ${parseFloat(tokens.fontScale) || 1};`);
    return lines.length ? `${selector} {\n${lines.join("\n")}\n}\n` : "";
  }

  function buildCSS(d) {
    if (!d) return "";
    let out = "";
    const tk = d.tokens || {};
    out += tokenBlock(":root", tk.light);
    out += tokenBlock('[data-theme="dark"]', tk.dark);

    // base font size / family are page-level, not variables
    const base = tk.base || {};
    const bodyBits = [];
    if (base.fontSize) bodyBits.push(`font-size: ${cleanVal(base.fontSize)};`);
    if (base.fontFamily) bodyBits.push(`font-family: ${cleanVal(base.fontFamily)};`);
    if (bodyBits.length) out += `body { ${bodyBits.join(" ")} }\n`;

    (d.rules || []).forEach(r => {
      const sel = clean(r.sel);
      if (!sel || !r.css) return;
      const props = Object.keys(r.css)
        .filter(p => r.css[p] !== "" && r.css[p] != null)
        .map(p => `  ${clean(p)}: ${cleanVal(r.css[p])} !important;`);
      if (props.length) out += `${sel} {\n${props.join("\n")}\n}\n`;
    });

    (d.hidden || []).forEach(sel => {
      const s = clean(sel);
      if (s) out += `${s} { display: none !important; }\n`;
    });

    if (d.css) out += String(d.css).replace(/<\/?script/gi, "") + "\n";
    return out;
  }

  /* ---- wording overrides ---- */
  function setText(el, text) {
    const kids = Array.from(el.childNodes);
    const firstText = kids.find(n => n.nodeType === 3 && n.nodeValue.trim());
    if (firstText) { if (firstText.nodeValue !== text) firstText.nodeValue = text; return; }
    if (kids.some(n => n.nodeType === 1)) {
      // element-only content (icon spans…) — prepend our text instead of wiping it
      el.insertBefore(document.createTextNode(text), el.firstChild);
      return;
    }
    if (el.textContent !== text) el.textContent = text;
  }
  function applyTexts(d) {
    if (!d || !d.texts || !d.texts.length || !document.body) return;
    applyingText = true;
    const lang = document.documentElement.getAttribute("lang") || "en";
    d.texts.forEach(x => {
      if (x.lang && x.lang !== lang) return;   // wording written for the other language
      const sel = clean(x.sel);
      if (!sel) return;
      let list = [];
      try { list = document.querySelectorAll(sel); } catch { return; }
      list.forEach(el => setText(el, String(x.text)));
    });
    applyingText = false;
  }

  let textTimer = null;
  function watchTexts() {
    if (observer || !document.body) return;
    observer = new MutationObserver(() => {
      if (applyingText) return;
      clearTimeout(textTimer);
      textTimer = setTimeout(() => applyTexts(doc), 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function apply(d) {
    doc = d || null;
    styleEl().textContent = buildCSS(doc);
    if (document.body) { applyTexts(doc); watchTexts(); }
    else document.addEventListener("DOMContentLoaded", () => { applyTexts(doc); watchTexts(); });
  }

  /* ---- boot: cached first (instant), then the published version ---- */
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) apply(JSON.parse(cached));
  } catch {}

  async function refresh() {
    try {
      const base = (window.GYMORA_CONFIG && window.GYMORA_CONFIG.apiBase) || "/api";
      const r = await fetch(base + "/design", { headers: { Accept: "application/json" } });
      if (!r.ok) return;
      const data = await r.json();
      if (!data || typeof data !== "object") return;
      if (data.design) {
        apply(data.design);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(data.design)); } catch {}
      } else {
        apply(null);
        try { localStorage.removeItem(CACHE_KEY); } catch {}
      }
    } catch {}
  }

  window.GymoraDesign = {
    doc: () => doc,
    /* live preview from the Design studio (not saved anywhere) */
    preview: (d) => apply(d),
    refresh,
    reset: () => { apply(null); try { localStorage.removeItem(CACHE_KEY); } catch {} },
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => setTimeout(refresh, 300));
  else setTimeout(refresh, 300);
})();
