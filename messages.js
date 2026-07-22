/* =============================================================
   GYMORA — messages
   A real inbox shared by members, coaches, gym staff and owners:
   thread list → conversation → send. Signed-in accounts talk
   through the backend (netlify/functions/api.mjs); with no cloud
   session the same screens run on this browser's storage, so the
   prototype and the demo members still work offline.

   Rules (enforced again on the server): members message the coaches,
   staff and owner of their gym — not each other; staff-role accounts
   message anyone at their gym; admins can reach everybody.

   Uses globals from app.js / auth.js / portals.js:
   I18N, t, state, esc, initials, currentUser, toast, reRenderSection,
   switchSection, openFeature, featureSection, roleLabel, roleIcon,
   staffRoleName, goalLabel.
   ============================================================= */

const MSG_I18N = {
  en: {
    msgTab: "Messages", msgTitle: "Messages",
    msgSubMember: "Talk to the coaches and staff at your gym.",
    msgSubStaff: "Talk to your members and the rest of the team.",
    msgNew: "New message", msgNewSub: "Pick who to write to.",
    msgNoThreads: "No conversations yet. Start one — tap “New message”.",
    msgNoContacts: "Nobody to message yet. Members appear here once they join your gym.",
    msgSearchPeople: "Search people…",
    msgWrite: "Write a message…", msgSend: "Send", msgSendFail: "Message not sent — try again.",
    msgEmpty: "No messages yet. Say hello 👋",
    msgLoading: "Loading…", msgYou: "You",
    msgOffline: "Saved on this device — it will not reach them until you are signed in online.",
    msgBack: "Messages", msgUnread: "new",
    msgToday: "Today", msgYesterday: "Yesterday",
    msgLocalOnly: "Demo person — this chat stays on your device.",
  },
  ar: {
    msgTab: "الرسائل", msgTitle: "الرسائل",
    msgSubMember: "تواصل مع المدرّبين وموظّفي ناديك.",
    msgSubStaff: "تواصل مع أعضائك وبقيّة الفريق.",
    msgNew: "رسالة جديدة", msgNewSub: "اختر من تريد مراسلته.",
    msgNoThreads: "لا محادثات بعد. ابدأ واحدة — اضغط «رسالة جديدة».",
    msgNoContacts: "لا أحد لمراسلته بعد. سيظهر الأعضاء هنا فور انضمامهم لناديك.",
    msgSearchPeople: "ابحث عن شخص…",
    msgWrite: "اكتب رسالة…", msgSend: "إرسال", msgSendFail: "لم تُرسل الرسالة — حاول مجدداً.",
    msgEmpty: "لا رسائل بعد. ابدأ بالتحية 👋",
    msgLoading: "جارٍ التحميل…", msgYou: "أنت",
    msgOffline: "محفوظة على هذا الجهاز — لن تصل إليهم حتى تسجّل الدخول عبر الإنترنت.",
    msgBack: "الرسائل", msgUnread: "جديد",
    msgToday: "اليوم", msgYesterday: "أمس",
    msgLocalOnly: "شخص تجريبي — هذه المحادثة تبقى على جهازك.",
  },
};
Object.assign(I18N.en, MSG_I18N.en);
Object.assign(I18N.ar, MSG_I18N.ar);

/* ---------- state ---------- */
let msgView = "list";      // "list" | "thread" | "new"
let msgWith = null;        // { key, name, role, email, local }
let msgThreads = null;     // null = still loading
let msgItems = null;       // messages of the open thread
let msgContacts = null;    // people I may write to
let msgQuery = "";
let msgUnread = 0;
let msgPollTimer = null;

function resetMessages() { msgView = "list"; msgWith = null; msgThreads = null; msgItems = null; msgContacts = null; msgQuery = ""; }
const msgCloud = () => !!(window.GymoraCloud && GymoraCloud.hasSession());

/* ---------- this-device fallback store ----------
   gym_msgs = { "<my email>": { "<their key>": { name, role, email, msgs, unread } } } */
function msgLocalAll() { try { return JSON.parse(localStorage.getItem("gym_msgs") || "{}"); } catch { return {}; } }
function msgLocalSave(all) { try { localStorage.setItem("gym_msgs", JSON.stringify(all)); } catch {} }
function msgLocalBox(me) { const all = msgLocalAll(); return all[me.email] || {}; }
function msgLocalThreads(me) {
  const box = msgLocalBox(me);
  return Object.keys(box).map(k => {
    const th = box[k], last = (th.msgs || [])[th.msgs.length - 1];
    return { with: k, name: th.name, role: th.role, email: th.email || null, local: true, unread: th.unread || 0, last: last ? last.x : "", at: last ? last.at : 0 };
  }).sort((a, b) => (b.at || 0) - (a.at || 0));
}
function msgLocalSend(me, person, text) {
  const all = msgLocalAll();
  const at = Date.now();
  const box = all[me.email] || (all[me.email] = {});
  const th = box[person.key] || (box[person.key] = { name: person.name, role: person.role, email: person.email || null, msgs: [], unread: 0 });
  th.name = person.name; th.role = person.role;
  th.msgs.push({ f: me.email, x: text, at });
  th.msgs = th.msgs.slice(-300);
  th.unread = 0;

  /* If the other person also has an account on this device (the usual
     case while testing the prototype), drop the message in their inbox
     too so the conversation works from both sides. */
  const theirEmail = person.email;
  const known = theirEmail && typeof getUsers === "function" && getUsers().some(x => x.email === theirEmail);
  if (known) {
    const theirs = all[theirEmail] || (all[theirEmail] = {});
    const back = theirs[me.email] || (theirs[me.email] = { name: me.name, role: me.role || "user", email: me.email, msgs: [], unread: 0 });
    back.msgs.push({ f: me.email, x: text, at });
    back.msgs = back.msgs.slice(-300);
    back.unread = (back.unread || 0) + 1;
  }
  msgLocalSave(all);
  return th.msgs;
}

/* ---------- loading ---------- */
async function loadMsgThreads(silent) {
  const me = currentUser(); if (!me) return;
  let list = null;
  if (msgCloud()) {
    const r = await GymoraCloud.msgThreads();
    if (r.ok && r.data) list = (r.data.threads || []).map(x => ({ ...x, local: false, email: x.with }));
  }
  const local = msgLocalThreads(me).filter(x => !list || !list.some(c => c.with === x.with));
  msgThreads = (list || []).concat(local);
  msgUnread = msgThreads.reduce((n, x) => n + (x.unread || 0), 0);
  if (typeof renderAuthButton === "function") renderAuthButton();
  if (!silent) reRenderSection();
}

async function loadMsgThread(silent) {
  const me = currentUser(); if (!me || !msgWith) return;
  let items = null;
  if (!msgWith.local && msgWith.email && msgCloud()) {
    const r = await GymoraCloud.msgThread(msgWith.email);
    if (r.ok && r.data) {
      items = r.data.messages || [];
      if (r.data.contact && r.data.contact.name) msgWith.name = r.data.contact.name;
    }
  }
  if (items == null) {
    items = ((msgLocalBox(me)[msgWith.key] || {}).msgs) || [];
    // reading a conversation clears its unread count on this device too
    const all = msgLocalAll(), box = all[me.email];
    if (box && box[msgWith.key] && box[msgWith.key].unread) { box[msgWith.key].unread = 0; msgLocalSave(all); }
  }
  const grew = !msgItems || items.length !== msgItems.length;
  msgItems = items;
  if (!silent || grew) { reRenderSection(); scrollChatDown(); }
  if (msgThreads) { const th = msgThreads.find(x => x.with === msgWith.key); if (th && th.unread) { th.unread = 0; msgUnread = msgThreads.reduce((n, x) => n + (x.unread || 0), 0); if (typeof renderAuthButton === "function") renderAuthButton(); } }
}

/* the same "who may I write to" rules, applied to the accounts and
   demo people this browser knows about */
function localContacts(me) {
  const iAmStaff = typeof isStaffRole === "function" && isStaffRole(me.role);
  const allowed = (them) => {
    const r = them.role || "user";
    if (me.role === "admin" || r === "admin") return true;
    if (!iAmStaff && r === "user") return false;                       // members don't DM members
    if (me.gymId && them.gymId && me.gymId !== them.gymId) return false;
    return true;
  };
  const accounts = (typeof getUsers === "function" ? getUsers() : [])
    .filter(x => x.email !== me.email && !x.banned && allowed(x))
    .map(x => ({ key: x.email, email: x.email, name: x.name, role: x.role || "user", staffRole: x.staffRole || null, goal: x.goal || null, local: true }));
  const demo = (typeof coachMembers !== "undefined" && coachMembers ? coachMembers : [])
    .filter(p => !p.email && allowed(p))
    .map(p => ({ key: String(p.id), email: null, name: p.name, role: p.role || "user", staffRole: p.staffRole || null, goal: p.goal || null, local: true }));
  return accounts.concat(demo);
}

async function loadMsgContacts() {
  const me = currentUser(); if (!me) return;
  let list = null;
  if (msgCloud()) {
    const r = await GymoraCloud.contacts();
    if (r.ok && r.data) list = (r.data.contacts || []).map(c => ({ key: c.email, ...c, local: false }));
  }
  const extra = localContacts(me).filter(p => !list || !list.some(c => c.key === p.key));
  msgContacts = (list || []).concat(extra);
  reRenderSection();
}

/* keep an open conversation fresh without a page refresh */
function msgPoll() {
  clearTimeout(msgPollTimer);
  msgPollTimer = setTimeout(async () => {
    if (!document.getElementById("msgWrap")) return;      // screen closed
    if (msgView === "thread") await loadMsgThread(true);
    else if (msgView === "list") await loadMsgThreads(true);
    msgPoll();
  }, 9000);
}

/* background unread count for the avatar badge */
async function refreshMsgUnread() {
  const me = currentUser();
  if (!me) { msgUnread = 0; return; }
  if (msgCloud()) {
    const r = await GymoraCloud.msgThreads();
    if (r.ok && r.data) {
      msgUnread = r.data.unread || 0;
      if (typeof renderAuthButton === "function") renderAuthButton();
      return;
    }
  }
  msgUnread = msgLocalThreads(me).reduce((n, x) => n + (x.unread || 0), 0);
  if (typeof renderAuthButton === "function") renderAuthButton();
}

/* ---------- open a chat from anywhere (coach portal, owner team…) ---------- */
function openChatWith(person) {
  msgWith = {
    key: person.email || String(person.id || person.key),
    email: person.email || null,
    name: person.name || "",
    role: person.role || "user",
    local: !person.email || !msgCloud(),
  };
  msgView = "thread";
  msgItems = null;
  gotoMsgSection();
  setTimeout(() => loadMsgThread(), 0);
}

/* land on the messages screen wherever the app currently is */
function gotoMsgSection() {
  const drawer = document.getElementById("authBack");
  if (drawer && drawer.classList.contains("open")) { if (typeof switchSection === "function") switchSection("messages"); return; }
  if (typeof featureSection !== "undefined" && featureSection && typeof openFeature === "function") { openFeature("messages"); return; }
  if (typeof openAuth === "function") { openAuth("account"); if (typeof switchSection === "function") switchSection("messages"); }
}

/* ---------- views ---------- */
function msgTimeLabel(at) {
  if (!at) return "";
  const d = new Date(at), now = new Date();
  const time = d.toLocaleTimeString(state.lang === "ar" ? "ar-JO" : "en-US", { hour: "2-digit", minute: "2-digit" });
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return time;
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return `${t("msgYesterday")} ${time}`;
  return d.toLocaleDateString(state.lang === "ar" ? "ar-JO" : "en-US", { day: "numeric", month: "short" }) + " " + time;
}
function personLine(p) {
  if ((p.role || "user") === "user") return `🎯 ${typeof goalLabel === "function" && p.goal ? goalLabel(p.goal) : t("roleMember")}`;
  const sr = typeof staffRoleName === "function" ? staffRoleName(p.staffRole) : null;
  return `${typeof roleIcon === "function" ? roleIcon(p.role) : "👤"} ${typeof roleLabel === "function" ? roleLabel(p.role) : p.role}${sr ? " · " + sr : ""}`;
}

function secMessages(u) {
  if (!u) return "";
  setTimeout(msgPoll, 0);
  if (msgView === "thread" && msgWith) return msgThreadHTML(u);
  if (msgView === "new") return msgContactsHTML();
  if (msgThreads === null) setTimeout(() => loadMsgThreads(), 0);
  const staff = typeof isStaffRole === "function" && isStaffRole(u.role);
  const rows = (msgThreads || []).map(th => `
    <div class="portal-row msg-row" data-thread="${esc(th.with)}" data-thread-name="${esc(th.name || th.with)}" data-thread-role="${esc(th.role || "user")}" data-thread-email="${esc(th.email || (th.local ? "" : th.with))}" data-thread-local="${th.local ? 1 : 0}" style="cursor:pointer">
      <div class="pr-l"><div class="avatar-sm portal-av">${initials(th.name || th.with || "?")}</div>
        <div style="min-width:0">
          <div class="pr-name">${esc(th.name || th.with)}${th.unread ? ` <span class="msg-badge">${th.unread}</span>` : ""}</div>
          <div class="pr-meta msg-last">${esc(th.last || "")}</div>
        </div></div>
      <div class="pr-r"><span class="msg-time">${msgTimeLabel(th.at)}</span><span class="mi-arrow">›</span></div>
    </div>`).join("");
  return `
  <div id="msgWrap">
    <h3>💬 ${t("msgTitle")}</h3>
    <div class="h-sub">${staff ? t("msgSubStaff") : t("msgSubMember")}</div>
    <button class="btn" id="msgNewBtn" style="margin-bottom:12px">✍️ ${t("msgNew")}</button>
    ${msgThreads === null ? `<div class="note">${t("msgLoading")}</div>` : `
      <div class="portal-list">${rows || `<div class="note">${t("msgNoThreads")}</div>`}</div>`}
  </div>`;
}

function msgContactsHTML() {
  if (msgContacts === null) setTimeout(() => loadMsgContacts(), 0);
  const q = msgQuery.trim().toLowerCase();
  const shown = (msgContacts || []).filter(c => !q || (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q));
  return `
  <div id="msgWrap">
    <button class="linkbtn" id="msgBack" style="display:inline-block;margin:0 0 12px">‹ ${t("msgBack")}</button>
    <h3>✍️ ${t("msgNew")}</h3>
    <div class="h-sub">${t("msgNewSub")}</div>
    <input id="msgSearch" class="control" style="width:100%;margin-bottom:12px" placeholder="${t("msgSearchPeople")}" value="${esc(msgQuery)}">
    ${msgContacts === null ? `<div class="note">${t("msgLoading")}</div>` : `
    <div class="portal-list">
      ${shown.length ? shown.map(c => `
        <div class="portal-row" data-chat="${esc(c.key)}" data-chat-name="${esc(c.name)}" data-chat-role="${esc(c.role)}" data-chat-email="${esc(c.email || "")}" style="cursor:pointer">
          <div class="pr-l"><div class="avatar-sm portal-av">${initials(c.name || "?")}</div>
            <div><div class="pr-name">${esc(c.name)}</div><div class="pr-meta">${personLine(c)}</div></div></div>
          <div class="pr-r"><span class="mi-arrow">›</span></div>
        </div>`).join("") : `<div class="note">${t("msgNoContacts")}</div>`}
    </div>`}
  </div>`;
}

function msgThreadHTML(u) {
  const items = msgItems || [];
  if (msgItems === null) setTimeout(() => loadMsgThread(), 0);
  const bubbles = items.map(m => {
    const mine = m.f === u.email;
    return `<div class="bubble-row ${mine ? "me" : "them"}">
      <div class="bubble">${esc(m.x)}<span class="b-time">${msgTimeLabel(m.at)}</span></div>
    </div>`;
  }).join("");
  return `
  <div id="msgWrap">
    <button class="linkbtn" id="msgBack" style="display:inline-block;margin:0 0 12px">‹ ${t("msgBack")}</button>
    <div class="menu-head" style="margin-bottom:10px">
      <div class="avatar-lg">${initials(msgWith.name || "?")}</div>
      <div class="mh-txt"><div class="acct-name">${esc(msgWith.name)}</div>
        <div class="acct-email">${personLine(msgWith)}</div></div>
    </div>
    ${msgWith.local ? `<div class="note" style="margin-bottom:8px">📵 ${msgWith.email ? t("msgOffline") : t("msgLocalOnly")}</div>` : ""}
    <div class="chat-scroll" id="chatScroll">
      ${msgItems === null ? `<div class="note">${t("msgLoading")}</div>` : (bubbles || `<div class="note">${t("msgEmpty")}</div>`)}
    </div>
    <div class="chat-form">
      <textarea id="chatInput" class="control" rows="1" placeholder="${t("msgWrite")}"></textarea>
      <button class="btn" id="chatSend" aria-label="${t("msgSend")}">➤</button>
    </div>
  </div>`;
}

function scrollChatDown() {
  setTimeout(() => { const s = document.getElementById("chatScroll"); if (s) s.scrollTop = s.scrollHeight; }, 0);
}

/* ---------- sending ---------- */
async function sendChat() {
  const u = currentUser(); if (!u || !msgWith) return;
  const box = document.getElementById("chatInput");
  const text = (box ? box.value : "").trim();
  if (!text) return;
  if (box) box.value = "";
  const now = { f: u.email, x: text, at: Date.now() };
  msgItems = (msgItems || []).concat(now);      // optimistic: show it at once
  reRenderSection(); scrollChatDown();

  if (!msgWith.local && msgWith.email && msgCloud()) {
    const r = await GymoraCloud.msgSend(msgWith.email, text);
    if (r.ok) { msgThreads = null; return loadMsgThread(true); }
    if (!r.offline) { toast((r.data && r.data.error) || t("msgSendFail")); return; }
    msgWith.local = true;                        // backend unreachable → keep it here
  }
  msgLocalSend(u, msgWith, text);
  msgThreads = null;
}

/* ---------- events (called from auth.js) ---------- */
function handleMsgClick(e) {
  const hit = (s) => e.target.closest(s);
  if (hit("#msgNewBtn")) { msgView = "new"; msgQuery = ""; msgContacts = null; reRenderSection(); return true; }
  if (hit("#msgBack")) { msgView = "list"; msgWith = null; msgItems = null; msgThreads = null; reRenderSection(); return true; }
  if (hit("#chatSend")) { void sendChat(); return true; }
  const th = hit("[data-thread]");
  if (th) {
    msgWith = {
      key: th.dataset.thread,
      email: th.dataset.threadEmail || null,      // kept even for device-only threads, so replies reach them
      name: th.dataset.threadName, role: th.dataset.threadRole,
      local: th.dataset.threadLocal === "1",
    };
    msgView = "thread"; msgItems = null;
    reRenderSection(); setTimeout(() => loadMsgThread(), 0);
    return true;
  }
  const c = hit("[data-chat]");
  if (c) {
    openChatWith({ email: c.dataset.chatEmail || null, id: c.dataset.chat, name: c.dataset.chatName, role: c.dataset.chatRole });
    return true;
  }
  return false;
}
function handleMsgInput(e) {
  if (e.target && e.target.id === "msgSearch") {
    msgQuery = e.target.value;
    const wrap = document.getElementById("msgWrap");
    if (!wrap) return true;
    // repaint just the list so the search box keeps focus
    reRenderSection();
    const box = document.getElementById("msgSearch");
    if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    return true;
  }
  return false;
}

/* Enter sends, Shift+Enter makes a new line */
document.addEventListener("keydown", (e) => {
  if (e.target && e.target.id === "chatInput" && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    void sendChat();
  }
});
document.addEventListener("input", (e) => { handleMsgInput(e); });

/* count unread in the background so the avatar can show a dot */
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => { if (currentUser()) refreshMsgUnread(); }, 1200);
  setInterval(() => { if (currentUser() && !document.getElementById("msgWrap")) refreshMsgUnread(); }, 60000);
});
