/* =============================================================
   FitJo — roles & portals (prototype)
   Coach portal, gym owner dashboard, and gym staff dashboard.
   Sign-in as User / Coach / Staff / Owner, organized into
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
    roleMember: "Member", roleCoach: "Coach", roleStaff: "Gym staff", roleOwner: "Gym owner",
    signInAs: "Signing in as", accountType: "Account type", yourGym: "Your gym", accessCode: "Access code (staff roles)",
    verifyTitle: "Verify your account", verifySub: "We sent a 6-digit code to your email.",
    verifyDemo: "Demo code (normally emailed):", verifyCodeLabel: "Enter the 6-digit code", verifyBtn: "Verify & enter",
    verifyResend: "Resend code", verifyBad: "That code isn't right — check and try again.", verifiedMsg: "Account verified 🎉",
    bannedMsg: "This account has been suspended. Contact support.",
    coachPortal: "Coach portal", ownerDash: "Owner dashboard", staffDash: "Staff dashboard",
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
  },
  ar: {
    roleMember: "عضو", roleCoach: "مدرّب", roleStaff: "موظّف نادٍ", roleOwner: "صاحب نادٍ",
    signInAs: "تسجيل الدخول كـ", accountType: "نوع الحساب", yourGym: "ناديك", accessCode: "رمز الوصول (للموظفين)",
    verifyTitle: "فعّل حسابك", verifySub: "أرسلنا رمزاً من 6 أرقام إلى بريدك.",
    verifyDemo: "الرمز التجريبي (يُرسل عادة بالبريد):", verifyCodeLabel: "أدخل الرمز المكوّن من 6 أرقام", verifyBtn: "تفعيل ودخول",
    verifyResend: "إعادة إرسال الرمز", verifyBad: "الرمز غير صحيح — تحقّق وحاول مجدداً.", verifiedMsg: "تم تفعيل الحساب 🎉",
    bannedMsg: "تم إيقاف هذا الحساب. تواصل مع الدعم.",
    coachPortal: "بوابة المدرّب", ownerDash: "لوحة صاحب النادي", staffDash: "لوحة الموظّف",
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
  },
};
Object.assign(I18N.en, PORTAL_I18N.en);
Object.assign(I18N.ar, PORTAL_I18N.ar);

const GYM_CAPACITY = 150;

/* ---------- roles ---------- */
const ROLES = ["user", "coach", "staff", "owner"];
function roleLabel(r) { return { user: t("roleMember"), coach: t("roleCoach"), staff: t("roleStaff"), owner: t("roleOwner") }[r] || t("roleMember"); }
function roleIcon(r) { return { user: "👤", coach: "🧑‍🏫", staff: "🪪", owner: "🏢" }[r] || "👤"; }
function isStaffRole(r) { return r === "coach" || r === "staff" || r === "owner"; }
function defaultSectionForRole(u) {
  if (!u) return "menu";
  return { coach: "coach", staff: "staff", owner: "owner" }[u.role] || "menu";
}
function ownerGym(u) { return GYMS.find(g => g.id === (u && u.gymId)) || GYMS[0]; }

/* ---------- account nav for the current role ---------- */
function navForRole(u) {
  const common = [["profile", "👤", t("myProfile")], ["preferences", "⚙️", t("preferences")], ["security", "🔒", t("security")]];
  if (u.role === "coach") return [["coach", "🧑‍🏫", t("coachPortal")], ...common];
  if (u.role === "owner") return [["owner", "🏢", t("ownerDash")], ...common];
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
  { name: "Omar Khalil", goal: "build", months: 3, lastDays: 1, phone: "+962790000001" },
  { name: "Lana Haddad", goal: "lose", months: 1, lastDays: 0, phone: "+962790000002" },
  { name: "Yousef Nseir", goal: "gain", months: 12, lastDays: 4, phone: "+962790000003" },
  { name: "Rana Aziz", goal: "fit", months: 1, lastDays: 2, phone: "+962790000004" },
  { name: "Sami Odeh", goal: "recomp", months: 3, lastDays: 7, phone: "+962790000005" },
  { name: "Dina Salem", goal: "lose", months: 1, lastDays: 1, phone: "+962790000006" },
  { name: "Karim Fares", goal: "build", months: 12, lastDays: 3, phone: "+962790000007" },
  { name: "Maya Tannous", goal: "fit", months: 1, lastDays: 0, phone: "+962790000008" },
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
function secCoach(u) {
  const subs = subscribers();
  const compose = coachMsgTo ? `
    <div class="section compose">
      <h4>✉️ ${t("message")} — ${esc(coachMsgName)}</h4>
      <textarea id="coachMsg" class="control" rows="3" placeholder="${t("msgPlaceholder")}"></textarea>
      <div class="ct-actions">
        <button class="btn" id="coachSend">${t("sendMsg")}</button>
        <button class="btn ghost" id="coachCancel">${t("cancel")}</button>
      </div>
    </div>` : "";
  return `
  <h3>🧑‍🏫 ${t("coachPortal")}</h3>
  <div class="h-sub">${t("subsSub")}</div>
  ${compose}
  <div class="stat-row">
    <div class="stat"><div class="n">${subs.length}</div><div class="l">${t("subscribers")}</div></div>
    <div class="stat"><div class="n">${subs.filter(s => s.lastDays <= 1).length}</div><div class="l">${t("today")}</div></div>
  </div>
  <div class="portal-list">
    ${subs.map(s => `
      <div class="portal-row">
        <div class="pr-l">${subAvatar(s)}<div><div class="pr-name">${esc(s.name)}${s.banned ? ` <span class="pill off">${t("banned")}</span>` : ""}</div>
          <div class="pr-meta">${goalLabel(s.goal)} · ${t("lastSeen")}: ${agoLabel(s.lastDays)}</div></div></div>
        <div class="pr-r">
          <button class="btn ghost sm" data-msg="${s.id}" data-msg-name="${esc(s.name)}">✉️ ${t("message")}</button>
          ${s.phone ? `<a class="btn ghost sm" href="tel:${s.phone}">📞</a><a class="btn sm" style="background:#25D366" href="https://wa.me/${s.phone.replace("+", "")}" target="_blank" rel="noopener">🟢</a>` : ""}
        </div>
      </div>`).join("")}
  </div>`;
}

/* ---------- gym owner dashboard ---------- */
function secOwner(u) {
  const gym = ownerGym(u);
  const occ = occupancy(gym);
  const head = Math.round(occ.pct / 100 * GYM_CAPACITY);
  const subs = subscribers();
  const revenue = subs.length * monthlyJOD(gym);
  return `
  <h3>🏢 ${t("ownerDash")}</h3>
  <div class="h-sub">${gym.name[state.lang]} · ${t("ownerSub")}</div>
  <div class="stat-row">
    <div class="stat"><div class="n" style="color:var(--accent)">${head}</div><div class="l">${t("inGymNow")}</div></div>
    <div class="stat"><div class="n">${subs.length}</div><div class="l">${t("totalSubs")}</div></div>
    <div class="stat"><div class="n" style="font-size:16px">${fmtPrice(revenue)}</div><div class="l">${t("monthlyRevenue")}</div></div>
  </div>
  <div class="section">
    <h4>📊 ${t("inGymNow")}</h4>
    <div class="occ-bar"><span style="width:${occ.pct}%;background:${occ.level === "busy" ? "#ef4444" : occ.level === "moderate" ? "#f59e0b" : "#22c55e"}"></span></div>
    <div class="kv"><span>${t("howBusy")}</span><span>${head} / ${GYM_CAPACITY}</span></div>
  </div>
  <div class="section">
    <h4>👥 ${t("membersMgmt")}</h4>
    <div class="portal-list">
      ${subs.map(s => `
        <div class="portal-row">
          <div class="pr-l">${subAvatar(s)}<div><div class="pr-name">${esc(s.name)}${s.banned ? ` <span class="pill off">${t("banned")}</span>` : ""}</div>
            <div class="pr-meta">${goalLabel(s.goal)}</div></div></div>
          <div class="pr-r">
            <button class="btn ghost sm" data-alert="${s.id}">🔔 ${t("alert")}</button>
            ${s.real
              ? `<button class="btn ghost sm" data-ban="${esc(s.email)}" style="color:#ef4444">${s.banned ? t("unban") : t("ban")}</button>`
              : `<button class="btn ghost sm" data-ban-demo="1" style="color:#ef4444">${t("ban")}</button>`}
          </div>
        </div>`).join("")}
    </div>
  </div>`;
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

/* ---------- event hooks (called by auth.js) ---------- */
function handlePortalClick(e) {
  const hit = (s) => e.target.closest(s);
  const msg = hit("[data-msg]");
  if (msg) { coachMsgTo = msg.dataset.msg; coachMsgName = msg.dataset.msgName || ""; reRenderSection(); return true; }
  if (hit("#coachSend")) { const v = (val("coachMsg") || "").trim(); coachMsgTo = null; reRenderSection(); toast(v ? `${t("msgSent")} ✓` : t("msgSent")); return true; }
  if (hit("#coachCancel")) { coachMsgTo = null; reRenderSection(); return true; }
  const alert = hit("[data-alert]"); if (alert) { toast(t("alerted")); return true; }
  const ban = hit("[data-ban]");
  if (ban) {
    const email = ban.dataset.ban, users = getUsers(), i = users.findIndex(x => x.email === email);
    if (i >= 0) { users[i].banned = !users[i].banned; saveUsers(users); toast(users[i].banned ? t("bannedOk") : t("unbannedOk")); reRenderSection(); }
    return true;
  }
  if (hit("[data-ban-demo]")) { toast(`${t("demoOnly")} — ${t("bannedOk")}`); return true; }
  if (hit("#staffValidate")) {
    const k = (val("staffKey") || "").trim().toUpperCase();
    const el = document.getElementById("staffKeyResult");
    if (el) el.textContent = /^FJ[-\s]?\d/.test(k) ? t("keyValid") : t("keyInvalid");
    return true;
  }
  if (hit("#staffCheckin")) { toast(t("checkedIn")); return true; }
  return false;
}
