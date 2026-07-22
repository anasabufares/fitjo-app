/* =============================================================
   GYMORA — support tickets
   Members chat with their coach; everything else at the gym —
   membership, payment, facilities, a complaint — is opened here as a
   ticket that lands in the gym staff & owner queue, gets answered and
   is closed when it's done.

   Two faces of one screen:
     member  → my tickets + "open a ticket" form
     staff / owner / admin → the gym's queue, filtered by status

   Talks to /api/tickets; with no cloud session everything runs on
   this browser's storage so the prototype still works.

   Uses globals from app.js / auth.js / portals.js:
   I18N, t, state, esc, currentUser, toast, reRenderSection, val,
   initials, fmtDate, isStaffRole, switchSection, openFeature.
   ============================================================= */

const TICKET_I18N = {
  en: {
    tkTab: "Help & tickets", tkQueue: "Support tickets",
    tkTitle: "Help & tickets", tkQueueTitle: "Support tickets",
    tkSubMember: "Ask the gym team about membership, payments, the facilities — anything that isn't training.",
    tkSubStaff: "Requests from your members. Answer them and close when they're done.",
    tkNew: "Open a ticket", tkNewSub: "Tell us what you need — the gym team answers here.",
    tkSubject: "Subject", tkSubjectHint: "e.g. Freeze my membership for 2 weeks",
    tkCategory: "What is it about", tkMessage: "Your message",
    tkSend: "Send to the gym team", tkSent: "Ticket opened ✓ — the gym team will answer here.",
    tkReply: "Reply", tkReplyPh: "Write a reply…", tkFailed: "Could not send — try again.",
    tkNeedText: "Write your message first.",
    tkNone: "No tickets yet.", tkNoneStaff: "No tickets right now — your members are happy 🎉",
    tkOpen: "Open", tkAnswered: "Answered", tkClosed: "Closed",
    tkAll: "All", tkStatus: "Status",
    tkClose: "Mark as closed", tkReopen: "Reopen", tkClosedOk: "Ticket closed",
    tkBack: "Tickets", tkFrom: "From", tkYou: "You", tkTeam: "Gym team",
    tkCatMembership: "Membership", tkCatPayment: "Payment", tkCatFacility: "Facilities",
    tkCatClass: "Classes", tkCatCoach: "My coach", tkCatOther: "Something else",
    tkOffline: "Saved on this device — it reaches the gym team once you're online.",
    tkOpenedAt: "Opened", tkGoTickets: "🎫 Open a ticket instead",
    tkNoCoachYet: "No coach at your gym has an account yet — open a ticket and the gym team will help.",
  },
  ar: {
    tkTab: "المساعدة والطلبات", tkQueue: "طلبات الدعم",
    tkTitle: "المساعدة والطلبات", tkQueueTitle: "طلبات الدعم",
    tkSubMember: "اسأل فريق النادي عن الاشتراك، الدفع، المرافق — أي شيء غير التدريب.",
    tkSubStaff: "طلبات أعضائك. أجب عليها وأغلقها عند الانتهاء.",
    tkNew: "فتح طلب", tkNewSub: "أخبرنا بما تحتاج — يجيبك فريق النادي هنا.",
    tkSubject: "الموضوع", tkSubjectHint: "مثال: تجميد اشتراكي لأسبوعين",
    tkCategory: "بخصوص ماذا", tkMessage: "رسالتك",
    tkSend: "إرسال لفريق النادي", tkSent: "تم فتح الطلب ✓ — سيجيبك فريق النادي هنا.",
    tkReply: "رد", tkReplyPh: "اكتب رداً…", tkFailed: "تعذّر الإرسال — حاول مجدداً.",
    tkNeedText: "اكتب رسالتك أولاً.",
    tkNone: "لا طلبات بعد.", tkNoneStaff: "لا طلبات حالياً — أعضاؤك سعداء 🎉",
    tkOpen: "مفتوح", tkAnswered: "تمت الإجابة", tkClosed: "مغلق",
    tkAll: "الكل", tkStatus: "الحالة",
    tkClose: "إغلاق الطلب", tkReopen: "إعادة فتح", tkClosedOk: "أُغلق الطلب",
    tkBack: "الطلبات", tkFrom: "من", tkYou: "أنت", tkTeam: "فريق النادي",
    tkCatMembership: "الاشتراك", tkCatPayment: "الدفع", tkCatFacility: "المرافق",
    tkCatClass: "الحصص", tkCatCoach: "مدرّبي", tkCatOther: "شيء آخر",
    tkOffline: "محفوظ على هذا الجهاز — يصل لفريق النادي عند الاتصال بالإنترنت.",
    tkOpenedAt: "فُتح", tkGoTickets: "🎫 افتح طلباً بدلاً من ذلك",
    tkNoCoachYet: "لا يوجد مدرّب بحساب في ناديك بعد — افتح طلباً وسيساعدك فريق النادي.",
  },
};
Object.assign(I18N.en, TICKET_I18N.en);
Object.assign(I18N.ar, TICKET_I18N.ar);

const TICKET_CATS = ["membership", "payment", "facility", "class", "coach", "other"];
const ticketCatLabel = (c) => ({
  membership: t("tkCatMembership"), payment: t("tkCatPayment"), facility: t("tkCatFacility"),
  class: t("tkCatClass"), coach: t("tkCatCoach"), other: t("tkCatOther"),
}[c] || t("tkCatOther"));
const ticketCatIcon = (c) => ({ membership: "🪪", payment: "💳", facility: "🏋️", class: "🗓️", coach: "🧑‍🏫", other: "💬" }[c] || "💬");
const ticketStatusLabel = (s) => ({ open: t("tkOpen"), answered: t("tkAnswered"), closed: t("tkClosed") }[s] || s);

/* ---------- state ---------- */
let tkView = "list";      // "list" | "new" | "one"
let tkList = null;
let tkOne = null;
let tkFilter = "open";    // staff queue filter: open | answered | closed | all
let tkUnread = 0;

function resetTickets() { tkView = "list"; tkList = null; tkOne = null; tkFilter = "open"; }
const tkCloud = () => !!(window.GymoraCloud && GymoraCloud.hasSession());
const tkIsTeam = (u) => ["staff", "owner", "admin"].includes(u && u.role);

/* ---------- this-device fallback ---------- */
function tkLocalAll() { try { return JSON.parse(localStorage.getItem("gym_tickets") || "[]"); } catch { return []; } }
function tkLocalSave(list) { try { localStorage.setItem("gym_tickets", JSON.stringify(list)); } catch {} }
function tkLocalVisible(u) {
  const all = tkLocalAll();
  return tkIsTeam(u)
    ? all.filter(x => u.role === "admin" || !u.gymId || !x.gymId || x.gymId === u.gymId)
    : all.filter(x => x.by === u.email);
}

/* ---------- loading ---------- */
async function loadTickets(silent) {
  const u = currentUser(); if (!u) return;
  let list = null;
  if (tkCloud()) {
    const r = await GymoraCloud.tickets();
    if (r.ok && r.data) { list = r.data.tickets || []; tkUnread = r.data.unread || 0; }
  }
  if (list == null) {
    list = tkLocalVisible(u).map(x => ({ ...x, last: (x.msgs[x.msgs.length - 1] || {}).x || "" }));
    tkUnread = 0;
  }
  tkList = list;
  if (!silent) reRenderSection();
}

async function loadTicket(id, silent) {
  if (tkCloud()) {
    const r = await GymoraCloud.ticket(id);
    if (r.ok && r.data) { tkOne = r.data.ticket; if (!silent) reRenderSection(); return; }
  }
  tkOne = tkLocalAll().find(x => x.id === id) || null;
  if (!silent) reRenderSection();
}

/* ---------- views ---------- */
function secTickets(u) {
  if (!u) return "";
  if (tkView === "one") return ticketOneHTML(u);
  if (tkView === "new") return ticketNewHTML();
  if (tkList === null) setTimeout(() => loadTickets(), 0);
  const team = tkIsTeam(u);
  const shown = (tkList || []).filter(x => !team || tkFilter === "all" || x.status === tkFilter);
  const count = (s) => (tkList || []).filter(x => s === "all" || x.status === s).length;
  const rows = shown.map(x => {
    const unread = team ? x.staffUnread : x.userUnread;
    return `
    <div class="portal-row" data-ticket="${esc(x.id)}" style="cursor:pointer">
      <div class="pr-l" style="min-width:0"><div class="tk-ic">${ticketCatIcon(x.category)}</div>
        <div style="min-width:0">
          <div class="pr-name">${esc(x.subject)}${unread ? ` <span class="msg-badge">${unread}</span>` : ""}</div>
          <div class="pr-meta msg-last">${team ? esc(x.byName || x.by) + " · " : ""}${esc(x.last || "")}</div>
        </div></div>
      <div class="pr-r"><span class="pill tk-${esc(x.status)}">${ticketStatusLabel(x.status)}</span><span class="mi-arrow">›</span></div>
    </div>`;
  }).join("");
  return `
  <div id="tkWrap">
    <h3>🎫 ${team ? t("tkQueueTitle") : t("tkTitle")}</h3>
    <div class="h-sub">${team ? t("tkSubStaff") : t("tkSubMember")}</div>
    ${team ? `
      <div class="seg" style="margin-bottom:12px">
        ${[["open", t("tkOpen")], ["answered", t("tkAnswered")], ["closed", t("tkClosed")], ["all", t("tkAll")]]
          .map(([k, l]) => `<button data-tkfilter="${k}" class="${tkFilter === k ? "active" : ""}">${l} · ${count(k)}</button>`).join("")}
      </div>`
      : `<button class="btn" id="tkNewBtn" style="margin-bottom:12px">✍️ ${t("tkNew")}</button>`}
    ${tkList === null ? `<div class="note">${t("msgLoading")}</div>` : `
      <div class="portal-list">${rows || `<div class="note">${team ? t("tkNoneStaff") : t("tkNone")}</div>`}</div>`}
  </div>`;
}

function ticketNewHTML() {
  return `
  <div id="tkWrap">
    <button class="linkbtn" id="tkBack" style="display:inline-block;margin:0 0 12px">‹ ${t("tkBack")}</button>
    <h3>✍️ ${t("tkNew")}</h3>
    <div class="h-sub">${t("tkNewSub")}</div>
    <div class="form-row"><label>${t("tkSubject")}</label><input id="tkSubjIn" placeholder="${t("tkSubjectHint")}"></div>
    <div class="form-row"><label>${t("tkCategory")}</label>
      <select id="tkCatIn">${TICKET_CATS.map(c => `<option value="${c}">${ticketCatIcon(c)} ${ticketCatLabel(c)}</option>`).join("")}</select></div>
    <div class="form-row"><label>${t("tkMessage")}</label>
      <textarea id="tkTextIn" class="control" rows="4" placeholder="${t("msgWrite")}"></textarea></div>
    <button class="btn" id="tkSendBtn">${t("tkSend")}</button>
  </div>`;
}

function ticketOneHTML(u) {
  if (!tkOne) return `<div id="tkWrap"><div class="note">${t("msgLoading")}</div></div>`;
  const team = tkIsTeam(u);
  const bubbles = (tkOne.msgs || []).map(m => {
    const mine = m.f === u.email;
    const who = mine ? t("tkYou") : (m.staff || m.f !== tkOne.by ? t("tkTeam") : esc(tkOne.byName || tkOne.by));
    return `<div class="bubble-row ${mine ? "me" : "them"}">
      <div class="bubble"><span class="b-who">${who}</span>${esc(m.x)}<span class="b-time">${msgTimeLabel(m.at)}</span></div>
    </div>`;
  }).join("");
  const closed = tkOne.status === "closed";
  return `
  <div id="tkWrap">
    <button class="linkbtn" id="tkBack" style="display:inline-block;margin:0 0 12px">‹ ${t("tkBack")}</button>
    <div class="tk-head">
      <div class="tk-ic lg">${ticketCatIcon(tkOne.category)}</div>
      <div style="min-width:0">
        <div class="acct-name">${esc(tkOne.subject)}</div>
        <div class="acct-email">${ticketCatLabel(tkOne.category)} · ${t("tkOpenedAt")} ${fmtDate(tkOne.createdAt)}${team ? " · " + esc(tkOne.byName || tkOne.by) : ""}</div>
      </div>
      <span class="pill tk-${esc(tkOne.status)}">${ticketStatusLabel(tkOne.status)}</span>
    </div>
    ${tkOne.local ? `<div class="note" style="margin-bottom:8px">📵 ${t("tkOffline")}</div>` : ""}
    <div class="chat-scroll" id="chatScroll">${bubbles}</div>
    ${closed ? `<button class="btn ghost" data-tkstatus="open">${t("tkReopen")}</button>` : `
      <div class="chat-form">
        <textarea id="tkReplyIn" class="control" rows="1" placeholder="${t("tkReplyPh")}"></textarea>
        <button class="btn" id="tkReplyBtn" aria-label="${t("tkReply")}">➤</button>
      </div>
      <button class="btn ghost sm" data-tkstatus="closed" style="margin-top:10px">✔ ${t("tkClose")}</button>`}
  </div>`;
}

/* ---------- actions ---------- */
async function openTicketNew() {
  const u = currentUser(); if (!u) return;
  const subject = (val("tkSubjIn") || "").trim();
  const category = val("tkCatIn") || "other";
  const text = (val("tkTextIn") || "").trim();
  if (!text) { toast(t("tkNeedText")); return; }

  if (tkCloud()) {
    const r = await GymoraCloud.ticketOpen(subject, category, text);
    if (r.ok && r.data) {
      toast(t("tkSent"));
      tkOne = r.data.ticket; tkView = "one"; tkList = null;
      reRenderSection(); scrollChatDown();
      return;
    }
    if (!r.offline) { toast((r.data && r.data.error) || t("tkFailed")); return; }
  }
  const now = Date.now();
  const ticket = {
    id: "tk" + now, subject: subject || "Support request", category,
    by: u.email, byName: u.name, gymId: u.gymId || null,
    status: "open", createdAt: now, updatedAt: now, local: true,
    msgs: [{ f: u.email, x: text, at: now }], staffUnread: 1, userUnread: 0,
  };
  const all = tkLocalAll(); all.unshift(ticket); tkLocalSave(all);
  toast(t("tkSent"));
  tkOne = ticket; tkView = "one"; tkList = null;
  reRenderSection(); scrollChatDown();
}

async function replyTicket() {
  const u = currentUser(); if (!u || !tkOne) return;
  const box = document.getElementById("tkReplyIn");
  const text = (box ? box.value : "").trim();
  if (!text) return;
  if (box) box.value = "";
  const team = tkIsTeam(u);
  tkOne.msgs = (tkOne.msgs || []).concat({ f: u.email, x: text, at: Date.now(), staff: team, name: u.name });
  reRenderSection(); scrollChatDown();

  if (!tkOne.local && tkCloud()) {
    const r = await GymoraCloud.ticketReply(tkOne.id, text);
    if (r.ok && r.data) { tkOne = r.data.ticket; tkList = null; reRenderSection(); scrollChatDown(); return; }
    if (!r.offline) { toast((r.data && r.data.error) || t("tkFailed")); return; }
  }
  const all = tkLocalAll();
  const i = all.findIndex(x => x.id === tkOne.id);
  if (i >= 0) {
    all[i].msgs = tkOne.msgs;
    all[i].status = team ? "answered" : "open";
    all[i].updatedAt = Date.now();
    if (team) all[i].userUnread = (all[i].userUnread || 0) + 1; else all[i].staffUnread = (all[i].staffUnread || 0) + 1;
    tkLocalSave(all);
    tkOne.status = all[i].status;
  }
  tkList = null;
}

async function setTicketStatus(status) {
  if (!tkOne) return;
  if (!tkOne.local && tkCloud()) {
    const r = await GymoraCloud.ticketStatus(tkOne.id, status);
    if (!r.ok && !r.offline) { toast((r.data && r.data.error) || t("tkFailed")); return; }
  }
  const all = tkLocalAll();
  const i = all.findIndex(x => x.id === tkOne.id);
  if (i >= 0) { all[i].status = status; tkLocalSave(all); }
  tkOne.status = status;
  tkList = null;
  toast(status === "closed" ? t("tkClosedOk") : ticketStatusLabel(status));
  reRenderSection();
}

/* jump to the tickets screen from anywhere (e.g. the messages screen) */
function gotoTickets() {
  tkView = "list"; tkList = null; tkOne = null;
  const drawer = document.getElementById("authBack");
  if (drawer && drawer.classList.contains("open")) { switchSection("tickets"); return; }
  if (typeof featureSection !== "undefined" && featureSection && typeof openFeature === "function") { openFeature("tickets"); return; }
  if (typeof openAuth === "function") { openAuth("account"); switchSection("tickets"); }
}

/* ---------- events (called from auth.js) ---------- */
function handleTicketClick(e) {
  const hit = (s) => e.target.closest(s);
  if (hit("#tkNewBtn")) { tkView = "new"; reRenderSection(); return true; }
  if (hit("#tkBack")) { tkView = "list"; tkOne = null; tkList = null; reRenderSection(); return true; }
  if (hit("#tkSendBtn")) { void openTicketNew(); return true; }
  if (hit("#tkReplyBtn")) { void replyTicket(); return true; }
  if (hit("#tkGoTickets")) { gotoTickets(); return true; }
  const f = hit("[data-tkfilter]");
  if (f) { tkFilter = f.dataset.tkfilter; reRenderSection(); return true; }
  const st = hit("[data-tkstatus]");
  if (st) { void setTicketStatus(st.dataset.tkstatus); return true; }
  const row = hit("[data-ticket]");
  if (row) {
    tkView = "one"; tkOne = null;
    reRenderSection();
    loadTicket(row.dataset.ticket).then(scrollChatDown);
    return true;
  }
  return false;
}

/* Enter sends a reply, Shift+Enter makes a new line */
document.addEventListener("keydown", (e) => {
  if (e.target && e.target.id === "tkReplyIn" && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void replyTicket();
  }
});
