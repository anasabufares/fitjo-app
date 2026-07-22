/* =============================================================
   GYMORA — admin studio
   Two consoles that live inside admin.html:

   1) Announcements — write a message that shows up inside the app
      for everyone you pick (all users, members, coaches & staff…).

   2) Design studio — change how the app LOOKS without touching code.
      The real app runs in the frame on the left; turn on "Pick",
      click anything in it, and edit its wording, colours, size,
      spacing or hide it. "Publish" saves the design document to the
      backend and every phone picks it up on next open (theme.js).

   Mounted by admin.html after the admin signs in:
      AdminStudio.mount({ token, mode, email })
   ============================================================= */

window.AdminStudio = (function () {
  const API = "/api";
  let ctx = { token: null, mode: "local", email: "" };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function api(path, method, body) {
    const headers = { "Content-Type": "application/json" };
    if (ctx.token) headers.Authorization = "Bearer " + ctx.token;
    try {
      const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json().catch(() => null);
      return { ok: r.ok, data, offline: !r.ok && data == null };
    } catch { return { ok: false, data: null, offline: true }; }
  }

  /* =========================================================
     1) ANNOUNCEMENTS
     ========================================================= */
  const AUDIENCES = [["all", "Everyone"], ["members", "Members"], ["staff", "Coaches & staff"], ["coaches", "Coaches only"], ["owners", "Gym owners"]];
  const KINDS = [["info", "ℹ️ Info"], ["warn", "⚠️ Important"], ["good", "🎉 Good news"]];

  function noticesUI() {
    const gymOpts = (typeof GYMS !== "undefined" ? GYMS : []).map(g => `<option value="${g.id}">${esc(g.name.en)}</option>`).join("");
    return `
      <h2>Announcements</h2>
      <div class="note" style="padding:0 0 12px">Write a message that appears inside the app — a bell in the top bar, a slide-down banner the first time it is seen, and a permanent list in the account menu.</div>
      <div class="ann-form">
        <div class="f"><label>Title</label><input id="anTitle" placeholder="New classes this week" /></div>
        <div class="f" style="grid-column:1/-1"><label>Message</label><textarea id="anBody" rows="3" placeholder="Write what you want your users to see…"></textarea></div>
        <div class="f"><label>Who sees it</label><select id="anAud">${AUDIENCES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
        <div class="f"><label>Style</label><select id="anKind">${KINDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
        <div class="f"><label>Limit to one gym (optional)</label><select id="anGym"><option value="">All gyms</option>${gymOpts}</select></div>
        <div class="f" style="align-self:end"><button class="act primary" id="anSend" style="margin:0;padding:10px 18px">📣 Publish announcement</button></div>
      </div>
      <div class="note" id="anMsg" style="padding:10px 0"></div>
      <div class="tablewrap"><table id="anTable"></table></div>`;
  }

  async function loadNotices() {
    const r = await api("/notices", "GET");
    const list = (r.ok && r.data && r.data.notices) || [];
    const t = $("#anTable");
    if (!t) return;
    t.innerHTML = `<tr><th>Title</th><th>Message</th><th>Audience</th><th>Sent</th><th></th></tr>` +
      (list.length ? list.map(n => `
        <tr>
          <td><b>${esc(n.title || "—")}</b></td>
          <td style="white-space:normal;max-width:420px">${esc((n.body || "").slice(0, 160))}</td>
          <td><span class="pill role">${esc(n.audience)}</span></td>
          <td>${new Date(n.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" })}</td>
          <td><button class="act danger" data-andel="${esc(n.id)}">Delete</button></td>
        </tr>`).join("") : `<tr><td colspan="5" class="note">No announcements yet.</td></tr>`);
  }

  async function sendNotice() {
    const title = $("#anTitle").value.trim(), body = $("#anBody").value.trim();
    const msg = $("#anMsg");
    if (!title && !body) { msg.textContent = "Write a title or a message first."; return; }
    const r = await api("/notices", "POST", {
      title, body, audience: $("#anAud").value, kind: $("#anKind").value, gymId: $("#anGym").value || null,
    });
    if (!r.ok) { msg.textContent = (r.data && r.data.error) || "Could not publish — is the backend reachable?"; return; }
    msg.textContent = "Published ✓ — users see it the next time the app opens.";
    $("#anTitle").value = ""; $("#anBody").value = "";
    loadNotices();
  }

  /* =========================================================
     2) DESIGN STUDIO
     ========================================================= */
  const PRESETS = {
    gymora: { name: "GYMORA green", accent: "#22c55e", accent2: "#4ade80" },
    ocean: { name: "Deep ocean", accent: "#3b82f6", accent2: "#60a5fa" },
    sunset: { name: "Sunset", accent: "#f97316", accent2: "#fb923c" },
    violet: { name: "Violet", accent: "#8b5cf6", accent2: "#a78bfa" },
    crimson: { name: "Crimson", accent: "#e11d48", accent2: "#fb7185" },
  };
  const FONTS = [
    ["", "App default"],
    ['-apple-system, "Segoe UI", Roboto, Arial, sans-serif', "System"],
    ['"Barlow Condensed", "Segoe UI", sans-serif', "Barlow Condensed"],
    ['Georgia, "Times New Roman", serif', "Serif"],
    ['ui-monospace, Consolas, monospace', "Monospace"],
  ];
  const EDITABLE = [
    ["color", "Text colour", "color"],
    ["background-color", "Background", "color"],
    ["font-size", "Text size", "px"],
    ["font-weight", "Weight", "select", ["", "400", "600", "700", "800", "900"]],
    ["text-align", "Align", "select", ["", "start", "center", "end"]],
    ["padding", "Inner spacing", "px"],
    ["margin-bottom", "Space below", "px"],
    ["border-radius", "Corner radius", "px"],
    ["border-color", "Border colour", "color"],
    ["opacity", "Opacity", "num"],
  ];

  const emptyDesign = () => ({ tokens: { light: {}, dark: {}, base: {} }, rules: [], texts: [], hidden: [], css: "" });
  let design = emptyDesign();
  let history = [];
  let picking = false;
  let selSelector = null;     // css selector of the selected element
  let selScope = "one";       // "one" = this element, "all" = everything that looks like it
  let textScope = "lang";     // wording applies to the previewed language, or "both"
  let selPath = null;         // precise path selector
  let selAll = null;          // class-based selector
  let editTheme = "dark";
  let armed = false;

  const frame = () => document.getElementById("dsFrame");
  const fw = () => { try { return frame().contentWindow; } catch { return null; } };
  const fd = () => { try { return frame().contentDocument; } catch { return null; } };

  function designUI() {
    return `
      <h2>Design studio</h2>
      <div class="note" style="padding:0 0 12px">
        The real app is running on the left. Walk it to the screen you want, press
        <b>🎯 Pick element</b>, then click any title, button or card to change its wording, colour,
        size, spacing — or hide it. Nothing is live until you press
        <b>✅ Publish to everyone</b>; <b>Reset everything</b> puts the original design back.
      </div>
      <div class="ds-bar">
        <button class="act" id="dsPick">🎯 Pick element</button>
        <span class="ds-sep"></span>
        <button class="act" data-dsdev="390">📱 Phone</button>
        <button class="act" data-dsdev="768">📗 Tablet</button>
        <button class="act" data-dsdev="1100">🖥️ Desktop</button>
        <span class="ds-sep"></span>
        <select class="ds-sel" id="dsGoto">
          <option value="">Go to screen…</option>
          <option value="home">Home / gym list</option>
          <option value="gym">A gym page</option>
          <option value="signin">Sign in</option>
          <option value="account">Account menu</option>
          <option value="messages">Messages</option>
          <option value="nutrition">Nutrition</option>
          <option value="library">Exercise library</option>
          <option value="rank">Rank</option>
        </select>
        <button class="act" id="dsReload">↻ Reload</button>
        <span class="ds-sep"></span>
        <button class="act" id="dsUndo">↶ Undo</button>
        <button class="act danger" id="dsResetAll">Reset everything</button>
        <button class="act primary" id="dsPublish" style="margin-inline-start:auto">✅ Publish to everyone</button>
      </div>
      <div class="ds-status" id="dsStatus">Loading the app preview…</div>
      <div class="ds-stage">
        <div class="ds-frame-wrap"><iframe id="dsFrame" src="/" title="App preview"></iframe></div>
        <aside class="ds-panel" id="dsPanel"></aside>
      </div>`;
  }

  const status = (msg) => { const el = $("#dsStatus"); if (el) el.textContent = msg; };

  /* ---- design document helpers ---- */
  function snapshot() { history.push(JSON.stringify(design)); if (history.length > 60) history.shift(); }
  function ruleFor(sel) {
    let r = design.rules.find(x => x.sel === sel);
    if (!r) { r = { sel, css: {} }; design.rules.push(r); }
    return r;
  }
  /* wording is stored per language: changing the English title must not
     wipe the Arabic one. lang "" = show this wording in both. */
  function frameLang() {
    const d = fd();
    return (d && d.documentElement.getAttribute("lang")) || "en";
  }
  function textFor(sel, lang) {
    let x = design.texts.find(y => y.sel === sel && (y.lang || "") === (lang || ""));
    if (!x) { x = { sel, text: "", lang: lang || "" }; design.texts.push(x); }
    return x;
  }
  function cleanEmpty() {
    design.rules = design.rules.filter(r => Object.keys(r.css).some(k => r.css[k] !== "" && r.css[k] != null));
    design.texts = design.texts.filter(x => x.text !== "" && x.text != null);
  }
  function preview() {
    cleanEmpty();
    const w = fw();
    if (w && w.GymoraDesign) w.GymoraDesign.preview(design);
  }

  /* ---- the preview frame ---- */
  function armFrame() {
    const d = fd();
    if (!d || !d.body) return;
    if (!d.getElementById("dsPickStyle")) {
      const st = d.createElement("style");
      st.id = "dsPickStyle";
      st.textContent = `
        .__dsHover { outline: 2px dashed #22c55e !important; outline-offset: -2px !important; cursor: crosshair !important; }
        .__dsSel { outline: 2px solid #22c55e !important; outline-offset: -2px !important; }`;
      d.head.appendChild(st);
    }
    d.addEventListener("mouseover", onHover, true);
    d.addEventListener("mouseout", onOut, true);
    d.addEventListener("click", onPickClick, true);
    armed = true;
    preview();
    status(picking ? "Pick mode is ON — click anything in the app." : "Preview ready. Use the app normally, or turn on “Pick element”.");
    if (selSelector) markSelected();
  }
  function onHover(e) { if (picking && e.target && e.target.classList) e.target.classList.add("__dsHover"); }
  function onOut(e) { if (e.target && e.target.classList) e.target.classList.remove("__dsHover"); }
  function onPickClick(e) {
    if (!picking) return;
    e.preventDefault(); e.stopPropagation();
    selectEl(e.target);
  }

  /* build a precise selector and a "everything like this" selector */
  function pathSelector(el) {
    const d = fd();
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== d.body && parts.length < 7) {
      if (cur.id) { parts.unshift("#" + cur.id); break; }
      let part = cur.tagName.toLowerCase();
      const cls = Array.from(cur.classList || []).filter(c => !c.startsWith("__ds") && !["on", "open", "show", "active"].includes(c));
      if (cls.length) part += "." + cls.slice(0, 2).join(".");
      const p = cur.parentElement;
      if (p) {
        const sibs = Array.from(p.children).filter(x => x.tagName === cur.tagName);
        if (sibs.length > 1) part += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(" > ") || "body";
  }
  function classSelector(el) {
    const cls = Array.from(el.classList || []).filter(c => !c.startsWith("__ds") && !["on", "open", "show", "active"].includes(c));
    if (cls.length) return "." + cls.slice(0, 2).join(".");
    if (el.id) return "#" + el.id;
    return el.tagName.toLowerCase();
  }
  function markSelected() {
    const d = fd(); if (!d) return;
    d.querySelectorAll(".__dsSel").forEach(x => x.classList.remove("__dsSel"));
    try { d.querySelectorAll(selSelector).forEach(x => x.classList.add("__dsSel")); } catch {}
  }
  function selectEl(el) {
    selPath = pathSelector(el);
    selAll = classSelector(el);
    selSelector = selScope === "all" ? selAll : selPath;
    markSelected();
    renderPanel();
  }

  /* ---- right-hand panel ---- */
  function renderPanel() {
    const panel = $("#dsPanel");
    if (!panel) return;
    panel.innerHTML = themePanel() + (selSelector ? elementPanel() : `
      <div class="ds-card">
        <h3>Nothing selected</h3>
        <p class="ds-hint">Turn on <b>🎯 Pick element</b>, then click any part of the app on the left — a title, a button, a card — and its settings appear here.</p>
      </div>`) + advancedPanel();
    markSelected();
  }

  function themePanel() {
    const tk = design.tokens[editTheme] || {};
    const base = design.tokens.base || {};
    const color = (key, label, fallback) => `
      <label class="ds-row"><span>${label}</span>
        <span class="ds-color">
          <input type="color" data-dstoken="${key}" value="${tk[key] || fallback}">
          ${tk[key] ? `<button class="ds-x" data-dstokenclear="${key}" title="reset">✕</button>` : ""}
        </span></label>`;
    return `
    <div class="ds-card">
      <h3>🎨 Brand &amp; theme</h3>
      <div class="ds-seg">
        <button data-dstheme="dark" class="${editTheme === "dark" ? "on" : ""}">🌙 Dark</button>
        <button data-dstheme="light" class="${editTheme === "light" ? "on" : ""}">☀️ Light</button>
      </div>
      <p class="ds-hint">Editing the <b>${editTheme}</b> theme — the preview switched to it too.</p>
      <div class="ds-presets">
        ${Object.keys(PRESETS).map(k => `<button class="ds-preset" data-dspreset="${k}" style="background:${PRESETS[k].accent}" title="${PRESETS[k].name}"></button>`).join("")}
      </div>
      ${color("accent", "Brand colour", "#22c55e")}
      ${color("bg", "Page background", editTheme === "dark" ? "#0a0a0a" : "#f4f6f8")}
      ${color("surface", "Cards", editTheme === "dark" ? "#141414" : "#ffffff")}
      ${color("text", "Text", editTheme === "dark" ? "#f2f4f2" : "#16202b")}
      ${color("muted", "Faint text", editTheme === "dark" ? "#9aa39e" : "#64748b")}
      ${color("border", "Lines", editTheme === "dark" ? "#262a27" : "#e2e8f0")}
      <label class="ds-row"><span>Corner roundness</span>
        <input type="range" min="0" max="34" value="${parseInt(tk.radius) || 16}" data-dstoken-px="radius"></label>
      <label class="ds-row"><span>Base text size</span>
        <input type="range" min="13" max="22" value="${parseInt(base.fontSize) || 16}" data-dsbase-px="fontSize"></label>
      <label class="ds-row"><span>Font</span>
        <select data-dsbase="fontFamily">${FONTS.map(([v, l]) => `<option value="${esc(v)}"${base.fontFamily === v ? " selected" : ""}>${l}</option>`).join("")}</select></label>
    </div>`;
  }

  function elementPanel() {
    const d = fd();
    let el = null;
    try { el = d.querySelector(selSelector); } catch {}
    let count = 0;
    try { count = d.querySelectorAll(selSelector).length; } catch {}
    const cs = el ? d.defaultView.getComputedStyle(el) : null;
    const rule = design.rules.find(r => r.sel === selSelector);
    const saved = (rule && rule.css) || {};
    const lang = textScope === "both" ? "" : frameLang();
    const txt = design.texts.find(x => x.sel === selSelector && (x.lang || "") === lang);
    const hidden = design.hidden.includes(selSelector);
    const currentText = el ? (Array.from(el.childNodes).find(n => n.nodeType === 3 && n.nodeValue.trim()) || {}).nodeValue : "";
    const canText = el && el.children.length <= 2 && (currentText || "").trim().length > 0;

    const field = ([prop, label, kind, opts]) => {
      const now = saved[prop] != null ? saved[prop] : "";
      const live = cs ? cs.getPropertyValue(prop) : "";
      if (kind === "color") {
        return `<label class="ds-row"><span>${label}</span>
          <span class="ds-color">
            <input type="color" data-dsprop="${prop}" value="${toHex(now || live)}">
            ${now ? `<button class="ds-x" data-dspropclear="${prop}">✕</button>` : ""}
          </span></label>`;
      }
      if (kind === "select") {
        return `<label class="ds-row"><span>${label}</span>
          <select data-dsprop="${prop}">${opts.map(o => `<option value="${o}"${now === o ? " selected" : ""}>${o || "default"}</option>`).join("")}</select></label>`;
      }
      if (kind === "num") {
        return `<label class="ds-row"><span>${label}</span>
          <input type="number" step="0.05" min="0" max="1" data-dsprop="${prop}" value="${now || parseFloat(live) || 1}"></label>`;
      }
      const px = parseInt(now) || parseInt(live) || 0;
      return `<label class="ds-row"><span>${label}</span>
        <span class="ds-px"><input type="number" data-dsprop-px="${prop}" value="${px}"><i>px</i>
        ${now ? `<button class="ds-x" data-dspropclear="${prop}">✕</button>` : ""}</span></label>`;
    };

    return `
    <div class="ds-card">
      <h3>✏️ Selected element</h3>
      <div class="ds-sel-info"><code>${esc(selSelector)}</code><span>${count} on this screen</span></div>
      <div class="ds-seg">
        <button data-dsscope="one" class="${selScope === "one" ? "on" : ""}">Just this one</button>
        <button data-dsscope="all" class="${selScope === "all" ? "on" : ""}">All like it</button>
      </div>
      ${canText ? `<label class="ds-row col"><span>Wording (${textScope === "both" ? "both languages" : frameLang().toUpperCase() + " only"})</span>
        <textarea data-dstext rows="2">${esc(txt ? txt.text : (currentText || "").trim())}</textarea></label>
        <div class="ds-seg">
          <button data-dstextscope="lang" class="${textScope === "lang" ? "on" : ""}">${frameLang().toUpperCase()} only</button>
          <button data-dstextscope="both" class="${textScope === "both" ? "on" : ""}">Both languages</button>
        </div>` : ""}
      ${EDITABLE.map(field).join("")}
      <label class="ds-row"><span>Hide it completely</span>
        <input type="checkbox" data-dshide ${hidden ? "checked" : ""}></label>
      <button class="act" data-dsclear style="width:100%;margin:10px 0 0">↺ Undo changes to this element</button>
    </div>`;
  }

  function advancedPanel() {
    return `
    <div class="ds-card">
      <h3>⚙️ Advanced</h3>
      <p class="ds-hint">Extra CSS for anything the buttons above don't cover. Optional — leave empty if unsure.</p>
      <textarea id="dsCss" rows="4" placeholder=".card { box-shadow: none; }">${esc(design.css || "")}</textarea>
      <div class="ds-count">${design.rules.length} element rule(s) · ${design.texts.length} wording change(s) · ${design.hidden.length} hidden</div>
    </div>`;
  }

  const toHex = (v) => {
    if (!v) return "#000000";
    v = String(v).trim();
    if (v.startsWith("#")) return v.length === 4 ? "#" + v.slice(1).split("").map(c => c + c).join("") : v.slice(0, 7);
    const m = v.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!m) return "#000000";
    return "#" + [1, 2, 3].map(i => (+m[i]).toString(16).padStart(2, "0")).join("");
  };

  /* ---- panel events ---- */
  function onPanelInput(e) {
    const el = e.target;
    const set = (fn) => { snapshot(); fn(); preview(); };

    const tokenKey = el.dataset.dstoken;
    if (tokenKey) { set(() => { design.tokens[editTheme][tokenKey] = el.value; }); return; }
    const tokenPx = el.dataset.dstokenPx;
    if (tokenPx) { set(() => { design.tokens[editTheme][tokenPx] = el.value + "px"; }); return; }
    const basePx = el.dataset.dsbasePx;
    if (basePx) { set(() => { design.tokens.base[basePx] = el.value + "px"; }); return; }
    if (el.dataset.dsbase) { set(() => { design.tokens.base[el.dataset.dsbase] = el.value; }); return; }

    const prop = el.dataset.dsprop;
    if (prop && selSelector) { set(() => { ruleFor(selSelector).css[prop] = el.value; }); return; }
    const propPx = el.dataset.dspropPx;
    if (propPx && selSelector) { set(() => { ruleFor(selSelector).css[propPx] = el.value + "px"; }); return; }
    if (el.hasAttribute("data-dstext") && selSelector) {
      set(() => { textFor(selSelector, textScope === "both" ? "" : frameLang()).text = el.value; });
      return;
    }
    if (el.hasAttribute("data-dshide") && selSelector) {
      set(() => {
        design.hidden = design.hidden.filter(s => s !== selSelector);
        if (el.checked) design.hidden.push(selSelector);
      });
      return;
    }
    if (el.id === "dsCss") { design.css = el.value; preview(); return; }
  }

  let softTimer = null;
  function renderPanelSoft() { clearTimeout(softTimer); softTimer = setTimeout(renderPanel, 400); }

  function onPanelClick(e) {
    const hit = (s) => e.target.closest(s);
    const theme = hit("[data-dstheme]");
    if (theme) {
      editTheme = theme.dataset.dstheme;
      const d = fd(); if (d && d.body) d.body.dataset.theme = editTheme;
      return renderPanel();
    }
    const preset = hit("[data-dspreset]");
    if (preset) {
      snapshot();
      const p = PRESETS[preset.dataset.dspreset];
      design.tokens.light.accent = design.tokens.dark.accent = p.accent;
      design.tokens.light.accent2 = design.tokens.dark.accent2 = p.accent2;
      preview(); return renderPanel();
    }
    const clearTok = hit("[data-dstokenclear]");
    if (clearTok) { snapshot(); delete design.tokens[editTheme][clearTok.dataset.dstokenclear]; preview(); return renderPanel(); }
    const scope = hit("[data-dsscope]");
    if (scope) {
      selScope = scope.dataset.dsscope;
      selSelector = selScope === "all" ? (selAll || selSelector) : (selPath || selSelector);
      markSelected(); return renderPanel();
    }
    const tscope = hit("[data-dstextscope]");
    if (tscope) { textScope = tscope.dataset.dstextscope; return renderPanel(); }
    const clearProp = hit("[data-dspropclear]");
    if (clearProp && selSelector) {
      snapshot();
      const r = design.rules.find(x => x.sel === selSelector);
      if (r) delete r.css[clearProp.dataset.dspropclear];
      preview(); return renderPanel();
    }
    if (hit("[data-dsclear]") && selSelector) {
      snapshot();
      const hadText = design.texts.some(x => x.sel === selSelector);
      design.rules = design.rules.filter(r => r.sel !== selSelector);
      design.texts = design.texts.filter(x => x.sel !== selSelector);
      design.hidden = design.hidden.filter(s => s !== selSelector);
      preview(); renderPanel();
      // wording already written into the page can only be taken back by
      // redrawing it, so reload the preview when a text change is dropped
      if (hadText) reloadFrame();
      return;
    }
  }

  /* ---- toolbar ---- */
  function setPicking(on) {
    picking = on;
    const b = $("#dsPick");
    if (b) { b.classList.toggle("primary", on); b.textContent = on ? "🎯 Pick mode: ON" : "🎯 Pick element"; }
    status(on ? "Pick mode is ON — click anything in the app to edit it." : "Pick mode is off — use the app normally to reach the screen you want.");
    const d = fd(); if (d) d.querySelectorAll(".__dsHover").forEach(x => x.classList.remove("__dsHover"));
  }

  function gotoScreen(where) {
    const w = fw(); if (!w) return;
    try {
      if (where === "home" && w.showList) w.showList();
      else if (where === "gym" && w.GYMS && w.openGym) w.openGym(w.GYMS[0].id);
      else if (where === "signin" && w.openAuth) w.openAuth("signin");
      else if (where === "account" && w.openAuth) w.openAuth("account");
      else if (where && w.openFeature) w.openFeature(where);
    } catch {}
    setTimeout(preview, 100);
  }

  async function publish() {
    cleanEmpty();
    if (ctx.mode !== "cloud" || !ctx.token) {
      try { localStorage.setItem("gym_design", JSON.stringify(design)); } catch {}
      status("Saved on this device only — the backend wasn't reachable, so other phones won't see it yet.");
      return;
    }
    status("Publishing…");
    const r = await api("/design", "PUT", { design });
    if (!r.ok) { status((r.data && r.data.error) || "Could not publish — try again."); return; }
    try { localStorage.setItem("gym_design", JSON.stringify(design)); } catch {}
    status("Published ✓ — every user gets this design the next time they open the app.");
  }

  function reloadFrame() {
    armed = false;
    try { frame().contentWindow.location.reload(); } catch {}
  }

  async function resetAll() {
    if (!confirm("Remove every design change and go back to the original look?")) return;
    snapshot();
    design = emptyDesign();
    preview();
    renderPanel();
    if (ctx.mode === "cloud" && ctx.token) await api("/design", "DELETE");
    try { localStorage.removeItem("gym_design"); } catch {}
    reloadFrame();
    status("Everything reset to the original design.");
  }

  function undo() {
    if (!history.length) { status("Nothing to undo."); return; }
    const hadTexts = design.texts.length;
    design = JSON.parse(history.pop());
    preview(); renderPanel();
    if (hadTexts > design.texts.length) reloadFrame();   // wording needs a redraw
    status("Undone.");
  }

  async function loadDesign() {
    const r = await api("/design", "GET");
    if (r.ok && r.data && r.data.design) design = { ...emptyDesign(), ...r.data.design, tokens: { light: {}, dark: {}, base: {}, ...(r.data.design.tokens || {}) } };
    else { try { const c = localStorage.getItem("gym_design"); if (c) design = { ...emptyDesign(), ...JSON.parse(c) }; } catch {} }
    if (!Array.isArray(design.rules)) design.rules = [];
    if (!Array.isArray(design.texts)) design.texts = [];
    if (!Array.isArray(design.hidden)) design.hidden = [];
    preview(); renderPanel();
  }

  /* =========================================================
     mount
     ========================================================= */
  function mount(context) {
    ctx = { ...ctx, ...context };
    const nPanel = document.getElementById("panelNotices");
    const dPanel = document.getElementById("panelDesign");
    if (nPanel && !nPanel.dataset.ready) {
      nPanel.innerHTML = noticesUI();
      nPanel.dataset.ready = "1";
      nPanel.addEventListener("click", (e) => {
        if (e.target.closest("#anSend")) return void sendNotice();
        const del = e.target.closest("[data-andel]");
        if (del) {
          if (!confirm("Delete this announcement?")) return;
          api("/notices", "DELETE", { id: del.dataset.andel }).then(loadNotices);
        }
      });
      loadNotices();
    }
    if (dPanel && !dPanel.dataset.ready) {
      dPanel.innerHTML = designUI();
      dPanel.dataset.ready = "1";
      const f = frame();
      f.addEventListener("load", () => { armed = false; setTimeout(armFrame, 400); });
      setTimeout(() => { if (!armed) armFrame(); }, 1500);

      dPanel.addEventListener("click", (e) => {
        const hit = (s) => e.target.closest(s);
        if (hit("#dsPick")) return setPicking(!picking);
        const dev = hit("[data-dsdev]");
        if (dev) { document.querySelector(".ds-frame-wrap").style.maxWidth = dev.dataset.dsdev + "px"; return; }
        if (hit("#dsReload")) { armed = false; f.contentWindow.location.reload(); return status("Reloading the preview…"); }
        if (hit("#dsUndo")) return undo();
        if (hit("#dsResetAll")) return void resetAll();
        if (hit("#dsPublish")) return void publish();
        if (e.target.closest("#dsPanel")) return onPanelClick(e);
      });
      dPanel.addEventListener("input", (e) => { if (e.target.closest("#dsPanel")) onPanelInput(e); });
      dPanel.addEventListener("change", (e) => {
        if (e.target.id === "dsGoto") { gotoScreen(e.target.value); e.target.value = ""; return; }
        if (e.target.closest("#dsPanel")) onPanelInput(e);
      });
      renderPanel();
      loadDesign();
    }
  }

  return { mount, reloadNotices: loadNotices };
})();
