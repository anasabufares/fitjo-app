/* =============================================================
   GYMORA — roles & portals (prototype)
   Coach portal, gym owner dashboard, gym staff dashboard, admin.
   Sign-in as User / Coach / Staff / Owner / Admin, organized into
   the account panel. Demo data + browser storage (Phase 2 backend
   replaces the sample subscribers, live occupancy and messaging).
   Relies on globals from app.js / auth.js:
   state, t, I18N, currentUser, getUsers, saveUsers, updateUser,
   reRenderSection, toast, esc, val, fmtDate, initials, goalLabel,
   GYMS, occupancy, fmtPrice, monthlyJOD.
   ============================================================= */

/* ---------- text ---------- */
const PORTAL_I18N = {
  en: {
    roleMember: "Member", roleCoach: "Coach", roleStaff: "Gym staff", roleOwner: "Gym owner", roleAdmin: "Admin",
    signInAs: "Signing in as", accountType: "Account type", yourGym: "Your gym", accessCode: "Access code (staff roles)",
    adminCodeHint: "Admins need the access code: GYMORA-ADMIN",
    verifyTitle: "Verify your account", verifySub: "We sent a 6-digit code to your email.",
    verifyDemo: "Demo code (normally emailed):", verifyCodeLabel: "Enter the 6-digit code", verifyBtn: "Verify & enter",
    verifyResend: "Resend code", verifyBad: "That code isn't right — check and try again.", verifiedMsg: "Account verified 🎉",
    bannedMsg: "This account has been suspended. Contact support.",
    coachPortal: "Coach portal", ownerDash: "Owner dashboard", staffDash: "Staff dashboard", adminPortal: "Admin portal",
    subscribers: "Subscribers", subsSub: "The members you coach. Message or contact them anytime.",
    message: "Message", sendMsg: "Send message", msgPlaceholder: "Write a message…", msgSent: "Message sent",
    lastSeen: "Last check-in", today: "Today", yesterday: "Yesterday", daysAgo: "days ago",
    inGymNow: "In the gym now", totalSubs: "Subscribers", monthlyRevenue: "Monthly revenue",
    membersMgmt: "Members", ban: "Ban", unban: "Unban", alert: "Alert", banned: "Suspended",
    alerted: "Alert sent", bannedOk: "Member suspended", unbannedOk: "Suspension lifted", demoOnly: "Demo member",
    ownerSub: "Live view of your gym and its members.",
    staffSub: "Check members in and validate digital membership keys.",
    validateKey: "Validate membership key", keyPlaceholder: "e.g. FJ-4821-KD", validate: "Validate",
    keyValid: "✅ Valid — active membership", keyInvalid: "❌ Not found or expired", checkinsToday: "Check-ins today",
    checkinMember: "Check a member in", memberEmail: "Member email", checkin: "Check in", checkedIn: "Checked in ✓",
    catMyGym: "My Gym", myTeam: "People at your gym",
    memberGoal: "Goal in the gym", memberDetails: "Member details", checkinsLabel: "Check-ins",
    loadingMembers: "Loading members…", noMembersYet: "No members at your gym yet — they'll appear here as soon as they sign up.",
    callBtn: "Call", membersByGoal: "What your members want",
    teamKeys: "Team access keys", teamKeysSub: "Generate a one-time key for a new coach or staff member at your gym. They use it once to create their account — keys are AES-128 secured. Gym owner keys come only from GYMORA.",
    keyType: "Key type", generateKey: "Generate key", newKeyIs: "New key — copy it and send it once:",
    keyCopied: "Key copied ✓", noKeysYet: "No keys yet. Generate one for your first coach or staff member.",
    keyFailed: "Could not create the key — try again.",
    statusAvailable: "Available", statusUsed: "Used by", statusRevoked: "Revoked", revokeKey: "Revoke",
    adminSub: "Manage the whole platform.",
    broadcast: "Broadcast to all users", broadcastSend: "Send to everyone", broadcastSent: "Broadcast sent to",
    banUser: "Suspend a user", giveaway: "Run a giveaway", giveawayRun: "Pick a winner", winner: "🎉 Winner:",
    freeStuff: "Grant free stuff", grantFree: "Grant 1-month free (demo)", granted: "Granted (demo)",
    totalUsers: "Total users", byRole: "By role", noUsers: "No matching users.",
  },
  ar: {
    roleMember: "عضو", roleCoach: "مدرّب", roleStaff: "موظّف نادٍ", roleOwner: "صاحب نادٍ", roleAdmin: "مشرف",
    signInAs: "تسجيل الدخول كـ", accountType: "نوع الحساب", yourGym: "ناديك", accessCode: "رمز الوصول (للموظفين)",
    adminCodeHint: "يحتاج المشرفون رمز الوصول: GYMORA-ADMIN",
    verifyTitle: "فعّل حسابك", verifySub: "أرسلنا رمزاً من 6 أرقام إلى بريدك.",
    verifyDemo: "الرمز التجريبي (يُرسل عادة بالبريد):", verifyCodeLabel: "أدخل الرمز المكوّن من 6 أرقام", verifyBtn: "تفعيل ودخول",
    verifyResend: "إعادة إرسال الرمز", verifyBad: "الرمز غير صحيح — تحقّق وحاول مجدداً.", verifiedMsg: "تم تفعيل الحساب 🎉",
    bannedMsg: "تم إيقاف هذا الحساب. تواصل مع الدعم.",
    coachPortal: "بوابة المدرّب", ownerDash: "لوحة صاحب النادي", staffDash: "لوحة الموظّف", adminPortal: "لوحة المشرف",
    subscribers: "المشتركون", subsSub: "الأعضاء الذين تدرّبهم. راسلهم أو تواصل معهم في أي وقت.",
    message: "رسالة", sendMsg: "إرسال رسالة", msgPlaceholder: "اكتب رسالة…", msgSent: "أُرسلت الرسالة",
    lastSeen: "آخر حضور", today: "اليوم", yesterday: "أمس", daysAgo: "أيام مضت",
    inGymNow: "في النادي الآن", totalSubs: "المشتركون", monthlyRevenue: "الدخل الشهري",
    membersMgmt: "الأعضاء", ban: "إيقاف", unban: "إلغاء الإيقاف", alert: "تنبيه", banned: "موقوف",
    alerted: "أُرسل التنبيه", bannedOk: "تم إيقاف العضو", unbannedOk: "أُلغي الإيقاف", demoOnly: "عضو تجريبي",
    ownerSub: "عرض مباشر لناديك وأعضائه.",
    staffSub: "سجّل حضور الأعضاء وتحقّق من مفاتيح العضوية الرقمية.",
    validateKey: "تحقّق من مفتاح العضوية", keyPlaceholder: "مثال FJ-4821-KD", validate: "تحقّق",
    keyValid: "✅ صالح — عضوية فعّالة", keyInvalid: "❌ غير موجود أو منتهٍ", checkinsToday: "حضور اليوم",
    checkinMember: "تسجيل حضور عضو", memberEmail: "بريد العضو", checkin: "تسجيل حضور", checkedIn: "تم التسجيل ✓",
    catMyGym: "ناديي", myTeam: "الأشخاص في ناديك",
    memberGoal: "الهدف في النادي", memberDetails: "تفاصيل العضو", checkinsLabel: "مرات الحضور",
    loadingMembers: "جارٍ تحميل الأعضاء…", noMembersYet: "لا أعضاء في ناديك بعد — سيظهرون هنا فور تسجيلهم.",
    callBtn: "اتصال", membersByGoal: "ماذا يريد أعضاؤك",
    teamKeys: "مفاتيح وصول الفريق", teamKeysSub: "أنشئ مفتاحاً لمرة واحدة لمدرّب أو موظّف جديد في ناديك. يستخدمه مرة واحدة لإنشاء حسابه — المفاتيح مؤمَّنة بتشفير AES-128. مفاتيح أصحاب الأندية تصدر من GYMORA فقط.",
    keyType: "نوع المفتاح", generateKey: "إنشاء مفتاح", newKeyIs: "مفتاح جديد — انسخه وأرسله مرة واحدة:",
    keyCopied: "تم نسخ المفتاح ✓", noKeysYet: "لا مفاتيح بعد. أنشئ واحداً لأول مدرّب أو موظّف.",
    keyFailed: "تعذّر إنشاء المفتاح — حاول مجدداً.",
    statusAvailable: "متاح", statusUsed: "استُخدم بواسطة", statusRevoked: "ملغي", revokeKey: "إلغاء",
    adminSub: "إدارة المنصّة بالكامل.",
    broadcast: "بثّ لكل المستخدمين", broadcastSend: "إرسال للجميع", broadcastSent: "أُرسل البثّ إلى",
    banUser: "إيقاف مستخدم", giveaway: "سحب جائزة", giveawayRun: "اختر فائزاً", winner: "🎉 الفائز:",
    freeStuff: "منح هدايا مجانية", grantFree: "منح شهر مجاني (تجريبي)", granted: "تم المنح (تجريبي)",
    totalUsers: "إجمالي المستخدمين", byRole: "حسب الدور", noUsers: "لا مستخدمين مطابقين.",
  },
};
Object.assign(I18N.en, PORTAL_I18N.en);
Object.assign(I18N.ar, PORTAL_I18N.ar);

const ADMIN_CODE = "GYMORA-ADMIN";
const GYM_CAPACITY = 150;

/* ---------- roles ---------- */
const ROLES = ["user", "coach", "staff", "owner", "admin"];
function roleLabel(r) { return { user: t("roleMember"), coach: t("roleCoach"), staff: t("roleStaff"), owner: t("roleOwner"), admin: t("roleAdmin") }[r] || t("roleMember"); }
function roleIcon(r) { return { user: "👤", coach: "🧑‍🏫", staff: "🪪", owner: "🏢", admin: "🛠️" }[r] || "👤"; }
function isStaffRole(r) { return r === "coach" || r === "staff" || r === "owner" || r === "admin"; }
function defaultSectionForRole(u) {
  if (!u) return "menu";
  return { coach: "coach", staff: "staff", admin: "admin" }[u.role] || "menu"; // owner opens on the front page
}
function ownerGym(u) { return GYMS.find(g => g.id === (u && u.gymId)) || GYMS[0]; }

/* ---------- account nav for the current role ---------- */
function navForRole(u) {
  const common = [["profile", "👤", t("myProfile")], ["preferences", "⚙️", t("preferences")], ["security", "🔒", t("security")]];
  if (u.role === "coach") return [["coach", "🧑‍🏫", t("coachPortal")], ...common];
  if (u.role === "owner") return common; // the owner dashboard lives on the front page (My Gym circle)
  if (u.role === "staff") return [["staff", "🪪", t("staffDash")], ...common];
  // regular member — side menu (nutrition/supplements/rank live on the
  // home-screen category circles; email moved inside Security)
  return [
    ["profile", "👤", t("myProfile")], ["plan", "🎯", t("myPlan")],
    ["workouts", "📋", t("workouts")], ["progress", "📈", t("myProgress")],
    ["points", "🏅", t("pointsRewards")], ["inbody", "🧬", t("inbodyScan")],
    ["security", "🔒", t("security")],
    ["privacy", "🛡️", t("privacy")], ["notifications", "🔔", t("notifications")],
    ["preferences", "⚙️", t("preferences")], ["danger", "⚠️", t("dangerZone")],
  ];
}

/* ---------- demo subscribers ---------- */
const SUB_SAMPLE = [
  { name: "Omar Khalil", goal: "build", months: 3, lastDays: 1, phone: "+962790000001", age: 27, gender: "m", startKg: 70, currentKg: 74 },
  { name: "Lana Haddad", goal: "lose", months: 1, lastDays: 0, phone: "+962790000002", age: 31, gender: "f", startKg: 78, currentKg: 74.5 },
  { name: "Yousef Nseir", goal: "gain", months: 12, lastDays: 4, phone: "+962790000003", age: 22, gender: "m", startKg: 66, currentKg: 69 },
  { name: "Rana Aziz", goal: "fit", months: 1, lastDays: 2, phone: "+962790000004", age: 26, gender: "f", startKg: 60, currentKg: 60 },
  { name: "Sami Odeh", goal: "recomp", months: 3, lastDays: 7, phone: "+962790000005", age: 35, gender: "m", startKg: 88, currentKg: 86 },
  { name: "Dina Salem", goal: "lose", months: 1, lastDays: 1, phone: "+962790000006", age: 29, gender: "f", startKg: 90, currentKg: 84 },
  { name: "Karim Fares", goal: "build", months: 12, lastDays: 3, phone: "+962790000007", age: 24, gender: "m", startKg: 80, currentKg: 85 },
  { name: "Maya Tannous", goal: "fit", months: 1, lastDays: 0, phone: "+962790000008", age: 21, gender: "f", startKg: 55, currentKg: 55.5 },
];
/* demo coaches & staff so the owner's team browser is never empty */
const TEAM_SAMPLE = [
  { name: "Hadi Mansour", role: "coach", phone: "+962795550001", age: 33, gender: "m", lastDays: 0, months: 8 },
  { name: "Nour Qasem", role: "coach", phone: "+962795550002", age: 27, gender: "f", lastDays: 1, months: 4 },
  { name: "Zaid Hamdan", role: "staff", phone: "+962795550003", age: 24, gender: "m", lastDays: 0, months: 12 },
];
function subscribers() {
  const real = getUsers().filter(x => x.role === "user").map(x => ({ id: x.id, name: x.name, goal: x.goal, email: x.email, banned: !!x.banned, real: true, lastDays: 0 }));
  const sample = SUB_SAMPLE.map((s, i) => ({ id: "s" + i, ...s, real: false, banned: false }));
  return real.concat(sample);
}
function agoLabel(d) { return d <= 0 ? t("today") : d === 1 ? t("yesterday") : `${d} ${t("daysAgo")}`; }
function subAvatar(s) { return `<div class="avatar-sm portal-av">${initials(s.name)}</div>`; }

/* ---------- coach portal ---------- */
let coachMsgTo = null, coachMsgName = "";
let coachMembers = null;   // members loaded from the cloud (or this browser)
let coachSel = null;       // member id opened in the detail view

let ownerTab = "user"; // owner team browser: "user" | "coach" | "staff"
function resetPortals() { coachMembers = null; coachSel = null; coachMsgTo = null; ownerTab = "user"; }

const gymNameOf = (id) => { const g = GYMS.find(x => x.id === id); return g ? g.name[state.lang] : null; };
const genderName = (g) => g === "f" ? t("genderF") : g === "m" ? t("genderM") : t("genderNA");

/* people visible on this device: the gym's members (+ coaches & staff
   for the owner's view) plus demo samples */
function localCoachMembers(u) {
  const visible = u.role === "coach" ? ["user"] : ["user", "coach", "staff"];
  const real = getUsers()
    .filter(x => visible.includes(x.role || "user") && x.email !== u.email && (!u.gymId || !x.gymId || x.gymId === u.gymId))
    .map(x => {
      const ws = (x.weights || []).slice().sort((a, b) => a.date - b.date);
      const allow = !x.privacy || x.privacy.trainerContact !== false;
      return {
        id: x.id, name: x.name, role: x.role || "user", goal: x.goal || "fit", age: x.age || null, gender: x.gender || "na",
        email: allow ? x.email : null, phone: allow ? (x.phone || null) : null, gymId: x.gymId || null,
        points: x.points || 0, checkins: (x.checkinDates || []).length,
        startKg: ws.length ? ws[0].kg : null, currentKg: ws.length ? ws[ws.length - 1].kg : null,
        joined: x.createdAt || null, banned: !!x.banned, lastDays: 0, real: true,
      };
    });
  const sample = SUB_SAMPLE.map((s, i) => ({
    id: "s" + i, ...s, role: "user", email: null, gymId: u.gymId || null,
    points: 40 + i * 7, checkins: 3 + i * 2, joined: Date.now() - s.months * 30 * 86400000,
    banned: false, real: false,
  }));
  const team = u.role === "coach" ? [] : TEAM_SAMPLE.map((s, i) => ({
    id: "t" + i, ...s, goal: null, email: null, gymId: u.gymId || null,
    points: 0, checkins: 20 + i * 5, joined: Date.now() - s.months * 30 * 86400000,
    startKg: null, currentKg: null, banned: false, real: false,
  }));
  return real.concat(sample, team);
}

async function loadCoachMembers(u) {
  let cloud = null;
  if (window.GymoraCloud && GymoraCloud.hasSession()) {
    const r = await GymoraCloud.listMembers();
    if (r.ok && r.data) cloud = (r.data.members || []).map(m => ({ ...m, role: m.role || "user", lastDays: m.checkins ? 0 : 3, real: true }));
  }
  coachMembers = cloud != null
    ? cloud.concat(localCoachMembers(u).filter(x => !x.real)) // real people from the cloud + demo samples
    : localCoachMembers(u);
  reRenderSection();
}

function composeHTML() {
  return coachMsgTo ? `
    <div class="section compose">
      <h4>✉️ ${t("message")} — ${esc(coachMsgName)}</h4>
      <textarea id="coachMsg" class="control" rows="3" placeholder="${t("msgPlaceholder")}"></textarea>
      <div class="ct-actions">
        <button class="btn" id="coachSend">${t("sendMsg")}</button>
        <button class="btn ghost" id="coachCancel">${t("cancel")}</button>
      </div>
    </div>` : "";
}

function coachMemberHTML(m) {
  const me = currentUser();
  const backLabel = me && me.role === "owner" ? t("ownerDash") : t("coachPortal");
  const isMember = (m.role || "user") === "user";
  const kv = (k, v) => (v == null || v === "") ? "" : `<div class="kv"><span>${k}</span><span>${esc(String(v))}</span></div>`;
  const diff = (m.startKg != null && m.currentKg != null) ? m.currentKg - m.startKg : null;
  return `
  <button class="linkbtn" id="coachBack" style="display:inline-block;margin:0 0 12px">‹ ${backLabel}</button>
  <div class="menu-head" style="margin-bottom:12px">
    <div class="avatar-lg">${initials(m.name)}</div>
    <div class="mh-txt"><div class="acct-name">${esc(m.name)}${m.banned ? ` <span class="pill off">${t("banned")}</span>` : ""}</div>
      <div class="acct-email">${isMember ? `🎯 ${t("memberGoal")}: <b>${goalLabel(m.goal)}</b>` : `${roleIcon(m.role)} <b>${roleLabel(m.role)}</b>`}</div></div>
  </div>
  ${composeHTML()}
  <div class="stat-row">
    <div class="stat"><div class="n">${m.age ?? "—"}</div><div class="l">${t("age")}</div></div>
    <div class="stat"><div class="n">${m.currentKg ?? "—"}${m.currentKg != null ? "<small> kg</small>" : ""}</div><div class="l">${t("currentWeight")}</div></div>
    <div class="stat"><div class="n" style="color:${diff == null || diff === 0 ? "var(--text)" : diff < 0 ? "#16a34a" : "#dc2626"}">${diff == null ? "—" : (diff > 0 ? "+" : "") + diff.toFixed(1)}</div><div class="l">${t("change")}</div></div>
  </div>
  <div class="section">
    <h4>${t("memberDetails")}</h4>
    ${isMember ? kv(t("memberGoal"), goalLabel(m.goal)) : kv(t("accountType"), roleLabel(m.role))}
    ${kv(t("gender"), genderName(m.gender))}
    ${kv(t("phone"), m.phone)}
    ${kv(t("email"), m.email)}
    ${kv(t("yourGym"), gymNameOf(m.gymId))}
    ${kv(t("pointsRewards"), m.points)}
    ${kv(t("checkinsLabel"), m.checkins)}
    ${kv(t("memberSince"), m.joined ? fmtDate(m.joined) : null)}
    ${kv(t("startWeight"), m.startKg != null ? m.startKg + " kg" : null)}
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn ghost sm" data-msg="${esc(String(m.id))}" data-msg-name="${esc(m.name)}">✉️ ${t("message")}</button>
    ${m.phone ? `<a class="btn ghost sm" href="tel:${m.phone}">📞 ${t("callBtn")}</a>
      <a class="btn sm" style="background:#25D366;color:#fff" href="https://wa.me/${m.phone.replace("+", "")}" target="_blank" rel="noopener">🟢 WhatsApp</a>` : ""}
  </div>`;
}

function secCoach(u) {
  if (coachMembers === null) setTimeout(() => loadCoachMembers(u), 0);
  const subs = (coachMembers || []).filter(x => (x.role || "user") === "user");
  if (coachSel != null) {
    const m = subs.find(x => String(x.id) === String(coachSel));
    if (m) return coachMemberHTML(m);
    coachSel = null;
  }
  const goals = {};
  subs.forEach(s => { goals[s.goal] = (goals[s.goal] || 0) + 1; });
  const gym = u.gymId ? gymNameOf(u.gymId) : null;
  return `
  <h3>🧑‍🏫 ${t("coachPortal")}</h3>
  <div class="h-sub">${t("subsSub")}${gym ? " · " + gym : ""}</div>
  ${composeHTML()}
  <div class="stat-row">
    <div class="stat"><div class="n">${subs.length}</div><div class="l">${t("subscribers")}</div></div>
    <div class="stat"><div class="n">${subs.filter(s => s.lastDays <= 1).length}</div><div class="l">${t("today")}</div></div>
  </div>
  ${Object.keys(goals).length ? `
  <div style="margin:2px 0 12px">
    <div style="font-weight:700;font-size:13px;margin-bottom:6px">🎯 ${t("membersByGoal")}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${Object.keys(goals).map(g => `<span class="pill">${goalLabel(g)} · ${goals[g]}</span>`).join("")}</div>
  </div>` : ""}
  ${coachMembers === null ? `<div class="note">${t("loadingMembers")}</div>` : `
  <div class="portal-list">
    ${subs.length ? subs.map(s => `
      <div class="portal-row" data-member="${esc(String(s.id))}" style="cursor:pointer">
        <div class="pr-l">${subAvatar(s)}<div><div class="pr-name">${esc(s.name)}${s.banned ? ` <span class="pill off">${t("banned")}</span>` : ""}</div>
          <div class="pr-meta">🎯 ${goalLabel(s.goal)}${s.age ? " · " + s.age : ""} · ${t("lastSeen")}: ${agoLabel(s.lastDays)}</div></div></div>
        <div class="pr-r"><span class="mi-arrow">›</span></div>
      </div>`).join("") : `<div class="note">${t("noMembersYet")}</div>`}
  </div>`}`;
}

/* ---------- gym owner dashboard (front-page feature view) ---------- */
function secOwner(u) {
  if (!u || u.role !== "owner") { if (typeof showList === "function") setTimeout(showList, 0); return ""; }
  if (coachMembers === null) setTimeout(() => loadCoachMembers(u), 0);
  const team = coachMembers || [];
  if (coachSel != null) {
    const m = team.find(x => String(x.id) === String(coachSel));
    if (m) return coachMemberHTML(m);
    coachSel = null;
  }
  const gym = ownerGym(u);
  const occ = occupancy(gym);
  const head = Math.round(occ.pct / 100 * GYM_CAPACITY);
  const members = team.filter(x => (x.role || "user") === "user");
  const revenue = members.length * monthlyJOD(gym);
  const count = (r) => team.filter(x => (x.role || "user") === r).length;
  const shown = team.filter(x => (x.role || "user") === ownerTab);
  const tabs = [["user", "👤", t("roleMember")], ["coach", "🧑‍🏫", t("roleCoach")], ["staff", "🪪", t("roleStaff")]];
  setTimeout(loadOwnerKeys, 0); // populate the keys list once the section is in the DOM
  return `
  <h3>🏢 ${t("ownerDash")}</h3>
  <div class="h-sub">${gym.name[state.lang]} · ${t("ownerSub")}</div>
  ${composeHTML()}
  <div class="stat-row">
    <div class="stat"><div class="n" style="color:var(--accent)">${head}</div><div class="l">${t("inGymNow")}</div></div>
    <div class="stat"><div class="n">${members.length}</div><div class="l">${t("totalSubs")}</div></div>
    <div class="stat"><div class="n" style="font-size:16px">${fmtPrice(revenue)}</div><div class="l">${t("monthlyRevenue")}</div></div>
  </div>
  <div class="section">
    <h4>📊 ${t("inGymNow")}</h4>
    <div class="occ-bar"><span style="width:${occ.pct}%;background:${occ.level === "busy" ? "#ef4444" : occ.level === "moderate" ? "#f59e0b" : "#22c55e"}"></span></div>
    <div class="kv"><span>${t("howBusy")}</span><span>${head} / ${GYM_CAPACITY}</span></div>
  </div>
  <div class="section">
    <h4>👥 ${t("myTeam")}</h4>
    <div class="seg" style="margin-bottom:12px">
      ${tabs.map(([r, ic, l]) => `<button data-oteam="${r}" class="${ownerTab === r ? "active" : ""}">${ic} ${l} · ${count(r)}</button>`).join("")}
    </div>
    ${coachMembers === null ? `<div class="note">${t("loadingMembers")}</div>` : `
    <div class="portal-list">
      ${shown.length ? shown.map(s => `
        <div class="portal-row" data-member="${esc(String(s.id))}" style="cursor:pointer">
          <div class="pr-l">${subAvatar(s)}<div><div class="pr-name">${esc(s.name)}${s.banned ? ` <span class="pill off">${t("banned")}</span>` : ""}</div>
            <div class="pr-meta">${ownerTab === "user" ? `🎯 ${goalLabel(s.goal)}${s.age ? " · " + s.age : ""}` : `${s.age ? s.age + " · " : ""}${t("lastSeen")}: ${agoLabel(s.lastDays || 0)}`}</div></div></div>
          <div class="pr-r">
            ${ownerTab === "user" ? `
              <button class="btn ghost sm" data-alert="${esc(String(s.id))}">🔔</button>
              ${s.real && s.email
                ? `<button class="btn ghost sm" data-ban="${esc(s.email)}" style="color:#ef4444">${s.banned ? t("unban") : t("ban")}</button>`
                : `<button class="btn ghost sm" data-ban-demo="1" style="color:#ef4444">${t("ban")}</button>`}` : ""}
            <span class="mi-arrow">›</span>
          </div>
        </div>`).join("") : `<div class="note">${t("noMembersYet")}</div>`}
    </div>`}
  </div>
  <div class="section">
    <h4>🔑 ${t("teamKeys")}</h4>
    <div class="h-sub">${t("teamKeysSub")}</div>
    <div class="form-two" style="align-items:end">
      <div class="form-row" style="margin:0"><label>${t("keyType")}</label>
        <select id="ownerKeyRole">
          <option value="coach">🧑‍🏫 ${t("roleCoach")}</option>
          <option value="staff">🪪 ${t("roleStaff")}</option>
        </select></div>
      <button class="btn" id="ownerKeyGen">${t("generateKey")}</button>
    </div>
    <div class="note" id="ownerKeyMsg" style="margin-top:10px;word-break:break-all">&nbsp;</div>
    <div class="portal-list" id="ownerKeyList"></div>
  </div>`;
}

/* ---- owner access keys: cloud when signed in, this browser otherwise ---- */
function keyRowHTML(k) {
  const status = k.revoked ? `<span class="pill off">${t("statusRevoked")}</span>`
    : k.usedBy ? `<span class="pill off">${t("statusUsed")} ${esc(k.usedBy)}</span>`
    : `<span class="pill on">${t("statusAvailable")}</span>`;
  const actions = (!k.usedBy && !k.revoked)
    ? `<button class="btn ghost sm" data-copykey="${esc(k.key)}" title="${t("keyCopied")}">📋</button>
       <button class="btn ghost sm" data-revokekey="${esc(k.key)}" style="color:#ef4444">${t("revokeKey")}</button>`
    : "";
  return `
    <div class="portal-row">
      <div class="pr-l" style="min-width:0"><div style="min-width:0">
        <div class="pr-name" style="font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12.5px;word-break:break-all;white-space:normal">${esc(k.key)}</div>
        <div class="pr-meta">${roleIcon(k.role)} ${roleLabel(k.role)} · ${new Date(k.createdAt).toLocaleDateString(state.lang === "ar" ? "ar-JO" : "en-US")}</div>
      </div></div>
      <div class="pr-r">${status}${actions}</div>
    </div>`;
}
async function loadOwnerKeys() {
  const u = currentUser();
  const el = document.getElementById("ownerKeyList");
  if (!u || u.role !== "owner" || !el) return;
  let keys = null;
  if (window.GymoraCloud && GymoraCloud.hasSession()) {
    const r = await GymoraCloud.listKeys();
    if (r.ok && r.data) keys = r.data.keys || [];
  }
  if (!keys) keys = window.GymoraKeys ? await GymoraKeys.list(k => k.issuedBy === u.email) : [];
  const box = document.getElementById("ownerKeyList"); // re-query: the section may have re-rendered
  if (box) box.innerHTML = keys.length ? keys.map(keyRowHTML).join("") : `<div class="note">${t("noKeysYet")}</div>`;
}
async function ownerGenerateKey() {
  const u = currentUser(); if (!u || u.role !== "owner") return;
  const role = val("ownerKeyRole") === "staff" ? "staff" : "coach";
  const msg = document.getElementById("ownerKeyMsg");
  let rec = null;
  if (window.GymoraCloud && GymoraCloud.hasSession()) {
    const r = await GymoraCloud.createKey(role, u.gymId || null);
    if (r.ok && r.data) rec = r.data.record;
    else if (!r.offline) { if (msg) msg.textContent = (r.data && r.data.error) || t("keyFailed"); return; }
  }
  if (!rec && window.GymoraKeys) rec = await GymoraKeys.create(role, u.gymId || null, u.email);
  if (!rec) { if (msg) msg.textContent = t("keyFailed"); return; }
  if (msg) msg.innerHTML = `${t("newKeyIs")} <b style="font-family:ui-monospace,Consolas,monospace">${esc(rec.key)}</b>`;
  copyKeyText(rec.key);
  loadOwnerKeys();
}
async function ownerRevokeKey(key) {
  if (window.GymoraCloud && GymoraCloud.hasSession()) {
    const r = await GymoraCloud.revokeKey(key);
    if (r.ok) { toast(t("statusRevoked")); return loadOwnerKeys(); }
    if (!r.offline) { toast(t("keyFailed")); return; }
  }
  if (window.GymoraKeys) await GymoraKeys.revoke(key);
  toast(t("statusRevoked"));
  loadOwnerKeys();
}
function copyKeyText(key) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(key).then(() => toast(t("keyCopied"))).catch(() => {});
  }
}

/* ---------- staff dashboard ---------- */
function secStaff(u) {
  return `
  <h3>🪪 ${t("staffDash")}</h3>
  <div class="h-sub">${t("staffSub")}</div>
  <div class="stat-row">
    <div class="stat"><div class="n">${18 + (new Date().getHours())}</div><div class="l">${t("checkinsToday")}</div></div>
  </div>
  <div class="section">
    <h4>🔑 ${t("validateKey")}</h4>
    <div class="form-two" style="align-items:end">
      <div class="form-row" style="margin:0"><label>${t("validateKey")}</label><input id="staffKey" placeholder="${t("keyPlaceholder")}"></div>
      <button class="btn" id="staffValidate">${t("validate")}</button>
    </div>
    <div id="staffKeyResult" class="note" style="margin-top:10px">&nbsp;</div>
  </div>
  <div class="section">
    <h4>✅ ${t("checkinMember")}</h4>
    <div class="form-two" style="align-items:end">
      <div class="form-row" style="margin:0"><label>${t("memberEmail")}</label><input id="staffEmail" type="email" placeholder="member@email.com"></div>
      <button class="btn" id="staffCheckin">${t("checkin")}</button>
    </div>
  </div>`;
}

/* ---------- admin portal ---------- */
function secAdmin(u) {
  const users = getUsers();
  const counts = ROLES.map(r => `${roleLabel(r)}: ${users.filter(x => (x.role || "user") === r).length}`).join(" · ");
  return `
  <h3>🛠️ ${t("adminPortal")}</h3>
  <div class="h-sub">${t("adminSub")}</div>
  <div class="stat-row">
    <div class="stat"><div class="n">${users.length}</div><div class="l">${t("totalUsers")}</div></div>
    <div class="stat"><div class="n">${GYMS.length}</div><div class="l">Gyms</div></div>
  </div>
  <div class="note">${t("byRole")}: ${counts}</div>
  <div class="section">
    <h4>📣 ${t("broadcast")}</h4>
    <textarea id="adminMsg" class="control" rows="2" placeholder="${t("msgPlaceholder")}"></textarea>
    <button class="btn" id="adminSend" style="margin-top:8px">${t("broadcastSend")}</button>
  </div>
  <div class="section">
    <h4>⛔ ${t("banUser")}</h4>
    <div class="form-two" style="align-items:end">
      <div class="form-row" style="margin:0"><label>${t("memberEmail")}</label><input id="adminBanEmail" type="email" placeholder="user@email.com"></div>
      <button class="btn" id="adminBan" style="background:#ef4444">${t("ban")}</button>
    </div>
  </div>
  <div class="section">
    <h4>🎁 ${t("giveaway")} · ${t("freeStuff")}</h4>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn ghost" id="adminGiveaway">🎲 ${t("giveawayRun")}</button>
      <button class="btn ghost" id="adminFree">🎁 ${t("grantFree")}</button>
    </div>
    <div id="adminResult" class="note" style="margin-top:10px">&nbsp;</div>
  </div>`;
}

/* ---------- event hooks (called by auth.js) ---------- */
function handlePortalClick(e) {
  const hit = (s) => e.target.closest(s);
  const msg = hit("[data-msg]");
  if (msg) { coachMsgTo = msg.dataset.msg; coachMsgName = msg.dataset.msgName || ""; reRenderSection(); return true; }
  if (hit("#coachSend")) { const v = (val("coachMsg") || "").trim(); coachMsgTo = null; reRenderSection(); toast(v ? `${t("msgSent")} ✓` : t("msgSent")); return true; }
  if (hit("#coachCancel")) { coachMsgTo = null; reRenderSection(); return true; }
  if (hit("#coachBack")) { coachSel = null; coachMsgTo = null; reRenderSection(); return true; }
  const oteam = hit("[data-oteam]"); if (oteam) { ownerTab = oteam.dataset.oteam; reRenderSection(); return true; }
  const alert = hit("[data-alert]"); if (alert) { toast(t("alerted")); return true; }
  const ban = hit("[data-ban]");
  if (ban) {
    const email = ban.dataset.ban, users = getUsers(), i = users.findIndex(x => x.email === email);
    if (i >= 0) { users[i].banned = !users[i].banned; saveUsers(users); toast(users[i].banned ? t("bannedOk") : t("unbannedOk")); coachMembers = null; }
    else toast(t("demoOnly")); // account lives in the cloud only — local ban n/a
    reRenderSection();
    return true;
  }
  if (hit("[data-ban-demo]")) { toast(`${t("demoOnly")} — ${t("bannedOk")}`); return true; }
  const mem = hit("[data-member]"); if (mem) { coachSel = mem.dataset.member; coachMsgTo = null; reRenderSection(); return true; }
  if (hit("#ownerKeyGen")) { void ownerGenerateKey(); return true; }
  const ck = hit("[data-copykey]"); if (ck) { copyKeyText(ck.dataset.copykey); return true; }
  const rk = hit("[data-revokekey]"); if (rk) { void ownerRevokeKey(rk.dataset.revokekey); return true; }
  if (hit("#staffValidate")) {
    const k = (val("staffKey") || "").trim().toUpperCase();
    const el = document.getElementById("staffKeyResult");
    if (el) el.textContent = /^FJ[-\s]?\d/.test(k) ? t("keyValid") : t("keyInvalid");
    return true;
  }
  if (hit("#staffCheckin")) { toast(t("checkedIn")); return true; }
  if (hit("#adminSend")) { toast(`${t("broadcastSent")} ${getUsers().length}`); return true; }
  if (hit("#adminBan")) {
    const email = (val("adminBanEmail") || "").trim().toLowerCase(), users = getUsers(), i = users.findIndex(x => x.email === email);
    if (i >= 0) { users[i].banned = true; saveUsers(users); toast(t("bannedOk")); } else { toast(t("noUsers")); }
    return true;
  }
  if (hit("#adminGiveaway")) {
    const pool = getUsers().filter(x => (x.role || "user") === "user");
    const el = document.getElementById("adminResult");
    if (el) el.textContent = pool.length ? `${t("winner")} ${pool[Math.floor(Math.random() * pool.length)].name}` : t("noUsers");
    return true;
  }
  if (hit("#adminFree")) { const el = document.getElementById("adminResult"); if (el) el.textContent = t("granted"); return true; }
  return false;
}
