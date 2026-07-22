/* =============================================================
   GYMORA — announcements
   A message written by GYMORA (admin) or by a gym owner that shows
   up inside the app for the people it targets: a bell in the top
   bar, a slide-down banner for anything not seen yet, and an
   "Announcements" screen in the account menu.

   Published through /api/notices; the last load is cached in this
   browser so the bell still works offline.
   ============================================================= */

const NOTICE_I18N = {
  en: {
    ntTab: "Announcements", ntTitle: "Announcements",
    ntSub: "News and messages from GYMORA and your gym.",
    ntNone: "Nothing new right now.",
    ntFrom: "GYMORA", ntFromGym: "Your gym",
    ntDismiss: "Got it", ntMarkAll: "Mark all as read",
    ntCompose: "Send an announcement", ntComposeSub: "It appears inside the app for everyone you pick.",
    ntFieldTitle: "Title", ntFieldBody: "Message", ntFieldAudience: "Who sees it", ntFieldKind: "Style",
    ntAudAll: "Everyone", ntAudMembers: "Members", ntAudStaff: "Coaches & staff", ntAudCoaches: "Coaches only", ntAudOwners: "Gym owners",
    ntKindInfo: "ℹ️ Info", ntKindWarn: "⚠️ Important", ntKindGood: "🎉 Good news",
    ntSend: "Publish announcement", ntSent: "Announcement published ✓", ntFailed: "Could not publish — try again.",
    ntNeedText: "Write a title or a message first.",
    ntMine: "Published", ntDelete: "Delete", ntDeleted: "Announcement deleted",
    ntGymScope: "Sent to your gym only.",
  },
  ar: {
    ntTab: "الإعلانات", ntTitle: "الإعلانات",
    ntSub: "أخبار ورسائل من GYMORA ومن ناديك.",
    ntNone: "لا جديد حالياً.",
    ntFrom: "GYMORA", ntFromGym: "ناديك",
    ntDismiss: "تمام", ntMarkAll: "تعليم الكل كمقروء",
    ntCompose: "إرسال إعلان", ntComposeSub: "يظهر داخل التطبيق لكل من تختارهم.",
    ntFieldTitle: "العنوان", ntFieldBody: "الرسالة", ntFieldAudience: "من يراه", ntFieldKind: "النمط",
    ntAudAll: "الجميع", ntAudMembers: "الأعضاء", ntAudStaff: "المدرّبون والموظفون", ntAudCoaches: "المدرّبون فقط", ntAudOwners: "أصحاب الأندية",
    ntKindInfo: "ℹ️ معلومة", ntKindWarn: "⚠️ مهم", ntKindGood: "🎉 خبر سار",
    ntSend: "نشر الإعلان", ntSent: "تم نشر الإعلان ✓", ntFailed: "تعذّر النشر — حاول مجدداً.",
    ntNeedText: "اكتب عنواناً أو رسالة أولاً.",
    ntMine: "المنشورة", ntDelete: "حذف", ntDeleted: "حُذف الإعلان",
    ntGymScope: "يُرسل لناديك فقط.",
  },
};
Object.assign(I18N.en, NOTICE_I18N.en);
Object.assign(I18N.ar, NOTICE_I18N.ar);

let notices = [];
let noticesLoaded = false;

const noticeSeen = () => { try { return JSON.parse(localStorage.getItem("gym_notices_seen") || "[]"); } catch { return []; } };
const noticeMarkSeen = (ids) => {
  const set = new Set(noticeSeen().concat(ids));
  try { localStorage.setItem("gym_notices_seen", JSON.stringify([...set].slice(-300))); } catch {}
};
const noticeUnseen = () => { const seen = noticeSeen(); return notices.filter(n => !seen.includes(n.id)); };

function noticeCache(list) { try { localStorage.setItem("gym_notices", JSON.stringify(list)); } catch {} }
function noticeCached() { try { return JSON.parse(localStorage.getItem("gym_notices") || "[]"); } catch { return []; } }

async function loadNotices(showBanner) {
  notices = noticeCached();
  renderNoticeBell();
  if (window.GymoraCloud && GymoraCloud.hasSession()) {
    const r = await GymoraCloud.notices();
    if (r.ok && r.data) { notices = r.data.notices || []; noticeCache(notices); }
  } else {
    try {
      const res = await fetch("/api/notices");
      if (res.ok) { const d = await res.json(); notices = d.notices || []; noticeCache(notices); }
    } catch {}
  }
  noticesLoaded = true;
  renderNoticeBell();
  if (showBanner) showNoticeBanner();
}

/* ---------- top-bar bell ---------- */
function renderNoticeBell() {
  const slot = document.getElementById("authSlot");
  if (!slot || !slot.parentNode) return;
  let bell = document.getElementById("noticeBell");
  if (!notices.length) { if (bell) bell.remove(); return; }
  if (!bell) {
    bell = document.createElement("button");
    bell.id = "noticeBell";
    bell.className = "icon-btn";
    bell.title = t("ntTitle");
    bell.onclick = openNoticeModal;
    slot.parentNode.insertBefore(bell, slot);
  }
  const n = noticeUnseen().length;
  bell.innerHTML = `🔔${n ? `<span class="bell-dot">${n > 9 ? "9+" : n}</span>` : ""}`;
}

function noticeKindStyle(kind) {
  return kind === "warn" ? { ic: "⚠️", col: "#f59e0b" } : kind === "good" ? { ic: "🎉", col: "var(--accent)" } : { ic: "📣", col: "#3b82f6" };
}
function noticeCardHTML(n) {
  const k = noticeKindStyle(n.kind);
  const when = new Date(n.createdAt).toLocaleDateString(state.lang === "ar" ? "ar-JO" : "en-US", { day: "numeric", month: "short" });
  return `
  <div class="notice-card" style="border-inline-start-color:${k.col}">
    <div class="nc-head"><span class="nc-ic">${k.ic}</span>
      <b>${esc(n.title || t("ntTitle"))}</b>
      <span class="nc-when">${when}</span></div>
    ${n.body ? `<div class="nc-body">${esc(n.body).replace(/\n/g, "<br>")}</div>` : ""}
    <div class="nc-from">${n.byRole === "owner" ? t("ntFromGym") : t("ntFrom")}</div>
  </div>`;
}

/* the modal behind the bell */
function openNoticeModal() {
  const body = document.getElementById("modalBody"), title = document.getElementById("modalTitle");
  if (!body || !title) return;
  title.textContent = "📣 " + t("ntTitle");
  body.innerHTML = notices.length
    ? `<div class="notice-list">${notices.map(noticeCardHTML).join("")}</div>`
    : `<div class="note">${t("ntNone")}</div>`;
  document.getElementById("modalBack").classList.add("open");
  noticeMarkSeen(notices.map(n => n.id));
  renderNoticeBell();
  hideNoticeBanner();
}

/* ---------- slide-down banner for the newest unseen announcement ---------- */
function showNoticeBanner() {
  const unseen = noticeUnseen();
  if (!unseen.length) return;
  const n = unseen[0];
  const k = noticeKindStyle(n.kind);
  hideNoticeBanner();
  const el = document.createElement("div");
  el.id = "noticeBanner";
  el.className = "notice-banner";
  el.innerHTML = `
    <span class="nb-ic" style="background:${k.col}">${k.ic}</span>
    <div class="nb-txt"><b>${esc(n.title || t("ntTitle"))}</b>${n.body ? `<span>${esc(n.body).slice(0, 130)}</span>` : ""}</div>
    <button class="nb-ok">${t("ntDismiss")}</button>`;
  el.querySelector(".nb-ok").onclick = (ev) => { ev.stopPropagation(); noticeMarkSeen([n.id]); renderNoticeBell(); hideNoticeBanner(); };
  el.onclick = openNoticeModal;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
}
function hideNoticeBanner() { const el = document.getElementById("noticeBanner"); if (el) el.remove(); }

/* ---------- account-menu screen ---------- */
function secNotices() {
  noticeMarkSeen(notices.map(n => n.id));
  setTimeout(renderNoticeBell, 0);
  return `
  <h3>📣 ${t("ntTitle")}</h3>
  <div class="h-sub">${t("ntSub")}</div>
  ${notices.length ? `<div class="notice-list">${notices.map(noticeCardHTML).join("")}</div>` : `<div class="note">${t("ntNone")}</div>`}`;
}

/* ---------- compose (admin portal + owner dashboard) ---------- */
function noticeComposeHTML(role) {
  setTimeout(loadMyNotices, 0);   // fill the "already published" list once it's in the DOM
  const auds = role === "owner"
    ? [["all", t("ntAudAll")], ["members", t("ntAudMembers")], ["staff", t("ntAudStaff")]]
    : [["all", t("ntAudAll")], ["members", t("ntAudMembers")], ["staff", t("ntAudStaff")], ["coaches", t("ntAudCoaches")], ["owners", t("ntAudOwners")]];
  return `
  <div class="section">
    <h4>📣 ${t("ntCompose")}</h4>
    <div class="h-sub">${t("ntComposeSub")}${role === "owner" ? " " + t("ntGymScope") : ""}</div>
    <div class="form-row"><label>${t("ntFieldTitle")}</label><input id="ntTitleIn" placeholder="${t("ntFieldTitle")}"></div>
    <div class="form-row"><label>${t("ntFieldBody")}</label><textarea id="ntBodyIn" class="control" rows="3" placeholder="${t("msgWrite")}"></textarea></div>
    <div class="form-two">
      <div class="form-row"><label>${t("ntFieldAudience")}</label>
        <select id="ntAudIn">${auds.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></div>
      <div class="form-row"><label>${t("ntFieldKind")}</label>
        <select id="ntKindIn">
          <option value="info">${t("ntKindInfo")}</option>
          <option value="warn">${t("ntKindWarn")}</option>
          <option value="good">${t("ntKindGood")}</option>
        </select></div>
    </div>
    <button class="btn" id="ntSendBtn">${t("ntSend")}</button>
    <div id="ntMineList" class="portal-list" style="margin-top:12px"></div>
  </div>`;
}

async function loadMyNotices() {
  const box = document.getElementById("ntMineList");
  if (!box) return;
  if (!noticesLoaded) await loadNotices();
  const u = typeof currentUser === "function" ? currentUser() : null;
  const mine = notices.filter(n => !u || n.by === u.email || u.role === "admin");
  const el = document.getElementById("ntMineList");
  if (!el) return;
  el.innerHTML = mine.length ? mine.map(n => `
    <div class="portal-row">
      <div class="pr-l" style="min-width:0"><div style="min-width:0">
        <div class="pr-name">${noticeKindStyle(n.kind).ic} ${esc(n.title || "—")}</div>
        <div class="pr-meta">${esc((n.body || "").slice(0, 70))}</div>
      </div></div>
      <div class="pr-r"><button class="btn ghost sm" data-ntdel="${esc(n.id)}" style="color:#ef4444">${t("ntDelete")}</button></div>
    </div>`).join("") : "";
}

async function publishNotice(role) {
  const title = (val("ntTitleIn") || "").trim();
  const body = (val("ntBodyIn") || "").trim();
  if (!title && !body) { toast(t("ntNeedText")); return; }
  const payload = { title, body, audience: val("ntAudIn") || "all", kind: val("ntKindIn") || "info" };
  if (window.GymoraCloud && GymoraCloud.hasSession()) {
    const r = await GymoraCloud.noticeCreate(payload);
    if (r.ok) {
      toast(t("ntSent"));
      const ti = document.getElementById("ntTitleIn"), bi = document.getElementById("ntBodyIn");
      if (ti) ti.value = ""; if (bi) bi.value = "";
      await loadNotices();
      return loadMyNotices();
    }
    if (!r.offline) { toast((r.data && r.data.error) || t("ntFailed")); return; }
  }
  // no backend reachable: keep it on this device so the demo still shows it
  notices = [{ id: "local" + Date.now(), ...payload, createdAt: Date.now(), active: true, byRole: role || "admin" }].concat(notices);
  noticeCache(notices);
  renderNoticeBell();
  toast(t("ntSent"));
  loadMyNotices();
}

async function deleteNotice(id) {
  if (window.GymoraCloud && GymoraCloud.hasSession() && !String(id).startsWith("local")) {
    const r = await GymoraCloud.noticeDelete(id);
    if (!r.ok && !r.offline) { toast((r.data && r.data.error) || t("ntFailed")); return; }
  }
  notices = notices.filter(n => n.id !== id);
  noticeCache(notices);
  toast(t("ntDeleted"));
  renderNoticeBell();
  loadMyNotices();
}

/* ---------- events (called from auth.js) ---------- */
function handleNoticeClick(e) {
  const hit = (s) => e.target.closest(s);
  if (hit("#ntSendBtn")) {
    const u = typeof currentUser === "function" ? currentUser() : null;
    void publishNotice(u && u.role);
    return true;
  }
  const del = hit("[data-ntdel]");
  if (del) { void deleteNotice(del.dataset.ntdel); return true; }
  return false;
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => loadNotices(true), 900);
  setInterval(() => loadNotices(true), 5 * 60000);
});
