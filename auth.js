/* =============================================================
   GYMORA — accounts & profile (prototype, browser-stored)
   Sign in / sign up / Google / 2FA authenticator / profile /
   security / email / privacy / notifications / preferences.
   NOTE: demo storage in localStorage — real Google OAuth and
   real TOTP 2FA arrive with the backend (Phase 2).
   Relies on globals from app.js: state, t, I18N, persist,
   applyChrome, renderControls, renderStaticText, renderFilters,
   renderResults, renderAll, CURRENCIES.
   ============================================================= */

let authView = null;          // "signin" | "signup" | "account"
let acctSection = "profile";
let tempSecret = null;

/* extra labels (profile photo + weight units) */
Object.assign(I18N.en, { changePhoto: "Change photo", removePhoto: "Remove", lb: "lb",
  adminCodeLabel: "Admin access code",
  roleMismatch: "This account is registered as {role}. Pick that type to sign in.",
  faceIdBtn: "Sign in with Face ID", faceId: "Face ID / biometric sign-in",
  faceIdDesc: "Use your face or fingerprint instead of a password on this device.",
  faceIdSetup: "Set up Face ID", faceIdRemove: "Remove", faceIdOn: "Face ID is on 🎉",
  faceIdOff: "Face ID removed", faceIdScanning: "Confirming it's you…",
  faceIdNone: "No Face ID on this account yet — sign in with your password once, then turn it on in Security.",
  faceIdNeedEmail: "Type your email first so we know whose face to check.",
  faceIdFail: "Face ID didn't work — use your password instead.",
  memberOnlyView: "Sign in to view gym details and compare gyms.",
  phone: "Phone number", phoneMissing: "Enter your phone number.",
  accessKey: "Access key",
  accessKeyHint: "Coach, gym staff and gym owner accounts need a one-time access key (AES-128 secured). Coaches and staff get theirs from their gym owner or GYMORA; gym owners get theirs from GYMORA.",
  accessKeyMissing: "Enter the access key you were given.",
  accessKeyBad: "That access key isn't valid for this account type — it may be used, revoked, or mistyped.",
  keyGymNote: "Your gym is set automatically by your access key.",
  signinKeyHint: "First time here? Create your account below with the access key you were given.",
  verifySentTo: "We emailed a 6-digit code to",
  verifyNet: "Couldn't reach the server — check your internet and try again." });
Object.assign(I18N.ar, { changePhoto: "تغيير الصورة", removePhoto: "إزالة", lb: "رطل",
  adminCodeLabel: "رمز وصول المشرف",
  roleMismatch: "هذا الحساب مسجّل كـ {role}. اختر هذا النوع لتسجيل الدخول.",
  faceIdBtn: "الدخول ببصمة الوجه", faceId: "بصمة الوجه / الدخول الحيوي",
  faceIdDesc: "استخدم وجهك أو بصمتك بدل كلمة المرور على هذا الجهاز.",
  faceIdSetup: "تفعيل بصمة الوجه", faceIdRemove: "إزالة", faceIdOn: "بصمة الوجه مفعّلة 🎉",
  faceIdOff: "أُزيلت بصمة الوجه", faceIdScanning: "نتأكد أنه أنت…",
  faceIdNone: "لا توجد بصمة وجه لهذا الحساب — سجّل بكلمة المرور مرة ثم فعّلها من الأمان.",
  faceIdNeedEmail: "اكتب بريدك أولاً لنعرف وجه من نتحقق.",
  faceIdFail: "لم تنجح بصمة الوجه — استخدم كلمة المرور.",
  memberOnlyView: "سجّل الدخول لعرض تفاصيل الأندية والمقارنة.",
  phone: "رقم الهاتف", phoneMissing: "أدخل رقم هاتفك.",
  accessKey: "مفتاح الوصول",
  accessKeyHint: "حسابات المدرّب وموظّف النادي وصاحب النادي تتطلب مفتاح وصول لمرة واحدة (مؤمَّن بتشفير AES-128). يحصل المدرّبون والموظفون على مفاتيحهم من صاحب النادي أو من GYMORA؛ ويحصل أصحاب الأندية على مفاتيحهم من GYMORA.",
  accessKeyMissing: "أدخل مفتاح الوصول الذي استلمته.",
  accessKeyBad: "مفتاح الوصول غير صالح لهذا النوع من الحسابات — قد يكون مستخدَماً أو ملغياً أو مكتوباً بشكل خاطئ.",
  keyGymNote: "يُحدَّد ناديك تلقائياً من مفتاح الوصول.",
  signinKeyHint: "أول مرة هنا؟ أنشئ حسابك أدناه باستخدام مفتاح الوصول الذي استلمته.",
  verifySentTo: "أرسلنا رمزاً من 6 أرقام إلى",
  verifyNet: "تعذّر الوصول إلى الخادم — تحقق من الإنترنت وحاول مجدداً." });

/* ---------- biometric (Face ID / fingerprint) ----------
   Uses the real device prompt (WebAuthn platform authenticator) when the
   browser supports it; falls back to a demo scan when opened from file://.
   Prototype note: the credential is checked on-device only (no server yet). */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const b64buf = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
function webAuthnAvailable() { return !!(window.PublicKeyCredential && window.isSecureContext); }

async function setupBiometric() {
  const u = currentUser(); if (!u) return;
  try {
    if (webAuthnAvailable()) {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "GYMORA" },
        user: { id: new TextEncoder().encode(u.email), name: u.email, displayName: u.name },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000,
      }});
      updateUser({ bioId: b64(cred.rawId) });
    } else {
      updateUser({ bioId: "demo" }); // offline/file:// demo
    }
    localStorage.setItem("fj_lastBio", u.email);
    toast(t("faceIdOn")); reRenderSection();
  } catch (e) { toast(t("faceIdFail")); }
}
function removeBiometric() { updateUser({ bioId: null }); toast(t("faceIdOff")); reRenderSection(); }

async function biometricSignIn() {
  const email = (val("inEmail") || "").trim().toLowerCase() || localStorage.getItem("fj_lastBio") || "";
  if (!email) return showErr(t("faceIdNeedEmail"));
  const u = getUsers().find(x => x.email === email);
  if (!u || !u.bioId) return showErr(t("faceIdNone"));
  if (u.banned) return showErr(t("bannedMsg"));
  toast(t("faceIdScanning"));
  try {
    if (u.bioId !== "demo" && webAuthnAvailable()) {
      await navigator.credentials.get({ publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: "public-key", id: b64buf(u.bioId), transports: ["internal"] }],
        userVerification: "required", timeout: 60000,
      }});
    } else {
      await new Promise(r => setTimeout(r, 700)); // demo scan
    }
    localStorage.setItem("fj_lastBio", email);
    setSession(email);
    if (!u.verified) return startVerify();
    afterAuth();
  } catch (e) { showErr(t("faceIdFail")); }
}

/* Resize an uploaded image to a small square data URL (keeps localStorage tiny). */
function resizeImage(file, max, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2, sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = max;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, side, side, 0, 0, max, max);
      cb(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => cb(null);
    img.src = reader.result;
  };
  reader.onerror = () => cb(null);
  reader.readAsDataURL(file);
}
function avatarInner(u) { return u.avatar ? `<img class="avatar-img" src="${u.avatar}" alt="">` : initials(u.name); }

/* ---------- storage ---------- */
const getUsers  = () => JSON.parse(localStorage.getItem("fj_users") || "[]");
const saveUsers = (u) => localStorage.setItem("fj_users", JSON.stringify(u));
const getSession = () => localStorage.getItem("fj_session") || null;
const setSession = (email) => localStorage.setItem("fj_session", email);
const clearSession = () => localStorage.removeItem("fj_session");
const currentUser = () => { const s = getSession(); return s ? getUsers().find(u => u.email === s) || null : null; };

/* ---------- helpers ---------- */
const obf = (pw) => btoa(unescape(encodeURIComponent(pw)));
const val = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map(w => (w[0] || "").toUpperCase()).join("") || "?";
const fmtDate = (ts) => new Date(ts).toLocaleDateString(state.lang === "ar" ? "ar-JO" : "en-US", { year: "numeric", month: "short" });

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2200);
}
function showErr(msg) { const el = document.getElementById("authErr"); if (el) { el.textContent = msg; el.classList.add("show"); } }

function updateUser(patch) {
  const users = getUsers();
  const i = users.findIndex(u => u.email === getSession());
  if (i < 0) return;
  users[i] = { ...users[i], ...patch };
  saveUsers(users);
  if (window.GymoraCloud) GymoraCloud.pushSoon(users[i]); // background: sync profile to the cloud
}
function createUser(data, provider = "email") {
  const users = getUsers();
  const u = {
    id: "u" + Date.now(), name: data.name, email: data.email, pw: obf(data.pw || Math.random().toString(36)),
    age: data.age || 18, gender: "na", goal: "fit", city: "", phone: data.phone || "", createdAt: Date.now(),
    role: data.role || "user", gymId: data.gymId || null, verified: !!data.verified, banned: false,
    twoFA: false, twoFASecret: null, recovery: [], passkeys: 0, provider,
    privacy: { profilePublic: true, showFav: false, trainerContact: true, shareData: true },
    notif: { offers: true, expiry: true, classes: true, news: false },
    intake: null, weights: [], reminders: { gym: { on: false, time: "19:00" }, rest: { on: false, time: "10:00" } },
  };
  users.push(u); saveUsers(users); return u;
}

/* ---------- top-bar button ---------- */
function renderAuthButton() {
  const slot = document.getElementById("authSlot"); if (!slot) return;
  const u = currentUser();
  if (u) {
    slot.innerHTML = `<button class="avatar-sm" id="acctBtn" title="${esc(u.name)}">${avatarInner(u)}</button>`;
    document.getElementById("acctBtn").onclick = () => openAuth("account");
  } else {
    slot.innerHTML = `<button class="control" id="signInBtn" style="font-weight:700">${t("signIn")}</button>`;
    document.getElementById("signInBtn").onclick = () => openAuth("signin");
  }
}

/* ---------- open / close ---------- */
function openAuth(view) {
  if (view === "account" && !currentUser()) view = "signin";
  authView = view;
  if (view === "account") { acctSection = (typeof defaultSectionForRole === "function" ? defaultSectionForRole(currentUser()) : "menu"); secSub = "hub"; }
  if (typeof resetPlanEditing === "function") resetPlanEditing();
  if (typeof resetPremium === "function") resetPremium();
  if (typeof resetLibrary === "function") resetLibrary();
  if (typeof resetNutrition === "function") resetNutrition();
  if (typeof resetPortals === "function") resetPortals(); // fresh member list each time
  document.getElementById("authBack").classList.add("open");
  document.body.style.overflow = "hidden";
  renderAuthView();
}
function closeAuth() {
  document.getElementById("authBack").classList.remove("open");
  document.body.style.overflow = "";
}
function requireAuth() {
  if (currentUser()) return true;
  toast(t("loggedOutMsg")); openAuth("signin"); return false;
}
function renderAuthView() {
  const modal = document.getElementById("authModal");
  if (authView === "account") { modal.className = "auth-modal drawer"; modal.innerHTML = accountHTML(); }
  else if (authView === "verify") { modal.className = "auth-modal"; modal.innerHTML = verifyHTML(); }
  else { modal.className = "auth-modal"; modal.innerHTML = authView === "signup" ? signupHTML() : signinHTML(); }
}

/* ---------- Google icon ---------- */
function googleG() {
  return `<svg class="google-g" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
}

/* ---------- sign in / sign up ---------- */
function signinHTML() {
  return `
  <button class="auth-x" id="authX">✕</button>
  <div class="auth-title">${t("welcomeBack")}</div>
  <div class="auth-sub">GYMORA · ${t("brandTag")}</div>
  <div class="form-err" id="authErr"></div>
  <div class="form-row"><label>${t("signInAs")}</label>
    <select id="inRoleSignin">${["user", "coach", "staff", "owner"].map(r => `<option value="${r}">${roleIcon(r)} ${roleLabel(r)}</option>`).join("")}</select>
    <div id="signinKeyHint" style="display:none;font-size:12px;color:var(--muted);margin-top:6px">🔑 ${t("signinKeyHint")}</div></div>
  <button class="google-btn" id="googleBtn">${googleG()} ${t("continueGoogle")}</button>
  <button class="google-btn faceid-btn" id="faceIdBtn"><span class="faceid-ico">🙂</span> ${t("faceIdBtn")}</button>
  <div class="divider">${t("orEmail")}</div>
  <div class="form-row"><label>${t("email")}</label><input id="inEmail" type="email" autocomplete="email" placeholder="you@email.com"></div>
  <div class="form-row"><label>${t("password")}</label><input id="inPassword" type="password" autocomplete="current-password" placeholder="••••••••"></div>
  <div style="text-align:end;margin:-4px 0 12px"><button class="auth-link" id="forgotPw">${t("forgotPw")}</button></div>
  <button class="btn block" id="doSignIn">${t("signIn")}</button>
  <div class="auth-foot"><button class="auth-link" id="toSignUp">${t("noAccount")}</button></div>
  <div class="note">${t("demoNote")}</div>`;
}
function signupHTML() {
  return `
  <button class="auth-x" id="authX">✕</button>
  <div class="auth-title">${t("createYourAccount")}</div>
  <div class="auth-sub">GYMORA · ${t("brandTag")}</div>
  <div class="form-err" id="authErr"></div>
  <button class="google-btn" id="googleBtn">${googleG()} ${t("continueGoogle")}</button>
  <div class="divider">${t("orEmail")}</div>
  <div class="form-row"><label>${t("fullName")}</label><input id="inName" type="text" placeholder="${t("fullName")}"></div>
  <div class="form-two">
    <div class="form-row"><label>${t("email")}</label><input id="inEmail" type="email" placeholder="you@email.com"></div>
    <div class="form-row"><label>${t("age")}</label><input id="inAge" type="number" min="12" max="100" placeholder="25"></div>
  </div>
  <div class="form-two">
    <div class="form-row"><label>${t("password")}</label><input id="inPassword" type="password" placeholder="••••••••"></div>
    <div class="form-row"><label>${t("confirmPassword")}</label><input id="inConfirm" type="password" placeholder="••••••••"></div>
  </div>
  <div class="form-two">
    <div class="form-row"><label>${t("accountType")}</label>
      <select id="inRole">${["user", "coach", "staff", "owner"].map(r => `<option value="${r}">${roleIcon(r)} ${roleLabel(r)}</option>`).join("")}</select></div>
    <div class="form-row" id="gymRow"><label>${t("yourGym")}</label>
      <select id="inGym">${GYMS.map(g => `<option value="${g.id}">${g.name[state.lang]}</option>`).join("")}</select></div>
  </div>
  <div class="form-row" id="phoneRow" style="display:none"><label>${t("phone")}</label>
    <input id="inPhone" type="tel" autocomplete="tel" placeholder="+9627XXXXXXXX"></div>
  <div class="form-row" id="accessKeyRow" style="display:none"><label>${t("accessKey")}</label>
    <input id="inAccessKey" type="text" autocomplete="off" spellcheck="false" placeholder="CH-XXXXXX-XXXXX-XXXXX-XXXXX-XXXXX" style="text-transform:uppercase">
    <div style="font-size:12px;color:var(--muted);margin-top:6px">${t("accessKeyHint")} ${t("keyGymNote")}</div></div>
  <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--muted);margin:4px 0 12px">
    <input type="checkbox" id="agreeAge"> ${t("agreeAge")}</label>
  <button class="btn block" id="doSignUp">${t("signUp")}</button>
  <div class="auth-foot"><button class="auth-link" id="toSignIn">${t("haveAccount")}</button></div>
  <div class="note">${t("demoNote")}</div>`;
}

/* ---------- account shell: side-menu drawer, two levels ----------
   Level 1 = the menu (avatar + item list). Level 2 = one section with
   a back chip. Feature pages on the main screen (nutrition/rank/shop)
   reuse the same sections via #featureBody. */
function accountHTML() {
  const u = currentUser();
  const nav = navForRole(u);
  if (acctSection === "menu") {
    return `
    <button class="auth-x" id="authX">✕</button>
    <div class="menu-head">
      <div class="avatar-lg">${avatarInner(u)}</div>
      <div class="mh-txt"><div class="acct-name">${esc(u.name)}</div><div class="acct-email">${esc(u.email)}</div></div>
    </div>
    <nav class="menu-list">
      ${nav.map(([k, ic, l]) => `<button class="menu-item" data-sec="${k}"><span class="mi-ic">${ic}</span><span class="mi-l">${l}</span><span class="mi-arrow">›</span></button>`).join("")}
      <button class="menu-item mi-signout" id="signOutBtn"><span class="mi-ic">↩</span><span class="mi-l">${t("signOut")}</span></button>
    </nav>`;
  }
  const item = nav.find(x => x[0] === acctSection);
  return `
  <button class="auth-x" id="authX">✕</button>
  <div class="sec-head"><button class="backchip" id="acctBack">‹</button><b>${item ? item[2] : ""}</b></div>
  <div class="acct-body" id="acctBody">${sectionHTML(acctSection)}</div>`;
}
function switchSection(sec) {
  acctSection = sec;
  if (sec === "security") secSub = "hub";
  renderAuthView();
}
function reRenderSection() {
  /* When the account drawer is open ON TOP of a feature page, the drawer
     is what the user sees — refresh it, not the page behind it. */
  const back = document.getElementById("authBack");
  const el = document.getElementById("acctBody");
  if (back && back.classList.contains("open") && el) { el.innerHTML = sectionHTML(acctSection); return; }
  const fb = document.getElementById("featureBody");
  if (fb && typeof featureSection !== "undefined" && featureSection) { fb.innerHTML = sectionHTML(featureSection); return; }
  if (el) el.innerHTML = sectionHTML(acctSection);
}

/* ---------- sections ---------- */
function sectionHTML(sec) {
  const u = currentUser();
  if (sec === "coach" && typeof secCoach === "function") return secCoach(u);
  if (sec === "owner" && typeof secOwner === "function") return secOwner(u);
  if (sec === "staff" && typeof secStaff === "function") return secStaff(u);
  if (sec === "admin" && typeof secAdmin === "function") return secAdmin(u);
  if (sec === "profile") return secProfile(u);
  if (sec === "plan" && typeof secPlan === "function") return typeof gatePremium === "function" ? gatePremium(u, secPlan) : secPlan(u);
  if (sec === "nutrition" && typeof secNutrition === "function") return secNutrition(u);
  if (sec === "rank" && typeof secRank === "function") return secRank(u);
  if (sec === "workouts" && typeof secWorkouts === "function") return typeof gatePremium === "function" ? gatePremium(u, secWorkouts) : secWorkouts(u);
  if (sec === "library" && typeof secLibrary === "function") return secLibrary(u);
  if (sec === "premium" && typeof secPremiumTab === "function") return secPremiumTab(u);
  if (sec === "supps" && typeof secSupps === "function") return secSupps(u);
  if (sec === "points" && typeof secPoints === "function") return secPoints(u);
  if (sec === "inbody" && typeof secInbody === "function") return secInbody(u);
  if (sec === "progress") return secProgress(u);
  if (sec === "security") return secSecurity(u);
  if (sec === "email") return secEmail(u);
  if (sec === "privacy") return secPrivacy(u);
  if (sec === "notifications") return secNotif(u);
  if (sec === "preferences") return secPrefs();
  if (sec === "danger") return secDanger();
  return "";
}
function goalOptions(sel) {
  return [["lose", t("goalLose")], ["build", t("goalBuild")], ["gain", t("goalGain")], ["recomp", t("goalRecomp")], ["fit", t("goalFit")]]
    .map(([k, l]) => `<option value="${k}"${sel === k ? " selected" : ""}>${l}</option>`).join("");
}
function toggleRow(kind, key, label, checked, desc) {
  return `<div class="set-row"><div class="txt"><div class="t">${label}</div>${desc ? `<div class="d">${desc}</div>` : ""}</div>
    <label class="switch"><input type="checkbox" data-${kind}="${key}" ${checked ? "checked" : ""}><span class="slider"></span></label></div>`;
}

function secProfile(u) {
  return `
  <h3>${t("myProfile")}</h3>
  <div class="h-sub">${t("memberSince")} ${fmtDate(u.createdAt)}${u.provider === "google" ? " · Google" : ""}</div>
  <div class="avatar-edit">
    <div class="avatar-lg">${avatarInner(u)}</div>
    <div>
      <label class="btn ghost" for="avatarInput">📷 ${t("changePhoto")}</label>
      <input id="avatarInput" type="file" accept="image/*" hidden>
      ${u.avatar ? `<button class="btn ghost" id="removeAvatar">${t("removePhoto")}</button>` : ""}
    </div>
  </div>
  <div class="stat-row">
    <div class="stat"><div class="n">${state.favorites.length}</div><div class="l">${t("savedGyms")}</div></div>
    <div class="stat"><div class="n">0</div><div class="l">${t("activeSubs")}</div></div>
    <div class="stat"><div class="n">${u.age}</div><div class="l">${t("age")}</div></div>
  </div>
  <div class="form-row"><label>${t("fullName")}</label><input id="pfName" value="${esc(u.name)}"></div>
  <div class="form-two">
    <div class="form-row"><label>${t("age")}</label><input id="pfAge" type="number" min="12" max="100" value="${u.age}"></div>
    <div class="form-row"><label>${t("city")}</label><input id="pfCity" value="${esc(u.city || "")}" placeholder="Amman"></div>
  </div>
  <div class="form-two">
    <div class="form-row"><label>${t("gender")}</label>
      <select id="pfGender">
        <option value="na"${u.gender === "na" ? " selected" : ""}>${t("genderNA")}</option>
        <option value="f"${u.gender === "f" ? " selected" : ""}>${t("genderF")}</option>
        <option value="m"${u.gender === "m" ? " selected" : ""}>${t("genderM")}</option>
      </select></div>
    <div class="form-row"><label>${t("goal")}</label><select id="pfGoal">${goalOptions(u.goal)}</select></div>
  </div>
  <button class="btn" id="saveProfile">${t("saveChanges")}</button>`;
}

function goalLabel(goal) {
  return { lose: t("goalLose"), build: t("goalBuild"), gain: t("goalGain"), recomp: t("goalRecomp"), fit: t("goalFit") }[goal] || t("goalFit");
}
function weightChart(entries) {
  if (!entries.length) return "";
  const w = 320, h = 120, pad = 12;
  const kgs = entries.map(e => e.kg);
  const min = Math.min(...kgs) - 1, max = Math.max(...kgs) + 1;
  const n = entries.length;
  const X = (i) => pad + (n === 1 ? (w - 2 * pad) / 2 : i * (w - 2 * pad) / (n - 1));
  const Y = (v) => pad + (h - 2 * pad) * (1 - (v - min) / (max - min || 1));
  const pts = entries.map((e, i) => `${X(i).toFixed(1)},${Y(e.kg).toFixed(1)}`).join(" ");
  const dots = entries.map((e, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(e.kg).toFixed(1)}" r="3.5" fill="var(--accent)"/>`).join("");
  const line = n > 1 ? `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>` : "";
  return `<svg viewBox="0 0 ${w} ${h}" class="wchart">${line}${dots}</svg>`;
}
function secProgress(u) {
  const entries = (u.weights || []).slice().sort((a, b) => a.date - b.date);
  const cur = entries.length ? entries[entries.length - 1].kg : null;
  const start = entries.length ? entries[0].kg : null;
  const diff = (cur != null && start != null) ? (cur - start) : 0;
  return `
  <h3>${t("myProgress")}</h3>
  <div class="h-sub">${t("weightTracker")}${u.goal ? " · " + goalLabel(u.goal) : ""}</div>
  ${entries.length ? `
    <div class="stat-row">
      <div class="stat"><div class="n">${start}<small> kg · ${toLb(start)} lb</small></div><div class="l">${t("startWeight")}</div></div>
      <div class="stat"><div class="n">${cur}<small> kg · ${toLb(cur)} lb</small></div><div class="l">${t("currentWeight")}</div></div>
      <div class="stat"><div class="n" style="color:${diff < 0 ? "#16a34a" : diff > 0 ? "#dc2626" : "var(--text)"}">${diff > 0 ? "+" : ""}${diff.toFixed(1)}</div><div class="l">${t("change")}</div></div>
    </div>
    ${weightChart(entries)}
    <div class="wlist">${entries.slice().reverse().map(e => `<div class="w-entry"><span>${fmtDate(e.date)}</span><span><b>${e.kg}</b> kg · ${toLb(e.kg)} lb <button class="auth-link" data-delw="${e.date}" style="margin-inline-start:8px">✕</button></span></div>`).join("")}</div>
  ` : `<div class="note">${t("noWeights")}</div>`}
  <div class="form-two" style="margin-top:14px;align-items:end">
    <div class="form-row" style="margin:0"><label>${t("weightKg")}</label><input id="wKg" type="number" step="0.1" min="20" max="400" placeholder="72.5"></div>
    <button class="btn" id="addWeight">${t("addWeight")}</button>
  </div>`;
}
function addWeight() {
  const kg = parseFloat(val("wKg"));
  if (!(kg >= 20 && kg <= 400)) return toast(t("weightKg"));
  const weights = (currentUser().weights || []).slice();
  weights.push({ date: Date.now(), kg: Math.round(kg * 10) / 10 });
  updateUser({ weights }); reRenderSection(); toast(t("saved"));
}
function delWeight(dateStr) {
  const weights = (currentUser().weights || []).filter(e => String(e.date) !== String(dateStr));
  updateUser({ weights }); reRenderSection();
}

/* ---------- security settings: hub + sub-pages ---------- */
let secSub = "hub";
function secSubBack() { return `<button class="linkbtn" data-secsub="hub" style="display:inline-block;margin:0 0 12px">‹ ${t("security")}</button>`; }
function secHubRow(ic, label, value, sub) {
  return `<button class="menu-item" data-secsub="${sub}">
    <span class="mi-ic">${ic}</span>
    <span class="mi-l">${label}<span class="sec-val">${value}</span></span>
    <span class="mi-arrow">›</span>
  </button>`;
}
function statusPill(on) { return on ? `<span class="pill on">${t("enabled")}</span>` : `<span class="pill off">${t("disabled")}</span>`; }
function secSecurity(u) {
  if (secSub === "email") return secSubBack() + secEmail(u);
  if (secSub === "password") return `${secSubBack()}
    <h3>${t("changePassword")}</h3>
    <div class="h-sub">&nbsp;</div>
    <div class="form-row"><label>${t("currentPassword")}</label><input id="curPw" type="password"></div>
    <div class="form-two">
      <div class="form-row"><label>${t("newPassword")}</label><input id="newPw" type="password"></div>
      <div class="form-row"><label>${t("confirmPassword")}</label><input id="confPw" type="password"></div>
    </div>
    <button class="btn" id="savePw">${t("changePassword")}</button>`;
  if (secSub === "twofa") return `${secSubBack()}
    <h3>${t("twoFA")} ${statusPill(u.twoFA)}</h3>
    <div class="h-sub">${t("twoFADesc")}</div>
    <div id="twoFABlock">${u.twoFA ? twoFAEnabledHTML(u) : `<button class="btn" id="enable2fa">${t("enable")}</button>`}</div>`;
  if (secSub === "bio") return `${secSubBack()}
    <h3>🙂 ${t("faceId")} ${statusPill(!!u.bioId)}</h3>
    <div class="h-sub">${t("faceIdDesc")}</div>
    ${u.bioId
      ? `<button class="btn ghost" id="removeBio">${t("faceIdRemove")}</button>`
      : `<button class="btn" id="setupBio">${t("faceIdSetup")}</button>`}`;
  // hub
  return `
  <nav class="menu-list sec-hub">
    ${secHubRow("✉️", t("email"), esc(u.email), "email")}
    ${secHubRow("🔑", t("password"), "••••••••", "password")}
    ${secHubRow("🛡️", t("twoFA"), u.twoFA ? t("enabled") : t("disabled"), "twofa")}
    ${secHubRow("🙂", t("faceId"), u.bioId ? t("enabled") : t("disabled"), "bio")}
  </nav>`;
}
function twoFAEnabledHTML(u) {
  return `
  <div class="note" style="margin-top:8px">✅ ${t("twoFAOn")}</div>
  <div style="font-weight:700;font-size:13px;margin-top:14px">${t("recoveryCodes")}</div>
  <div class="h-sub">${t("recoveryDesc")}</div>
  <div class="codes">${u.recovery.map(c => `<span>${c}</span>`).join("")}</div>
  <button class="btn ghost" id="disable2fa" style="margin-top:12px">${t("disable")}</button>`;
}

function secEmail(u) {
  return `
  <h3>${t("changeEmail")}</h3>
  <div class="h-sub">${t("email")}: ${esc(u.email)}</div>
  <div class="form-row"><label>${t("newEmail")}</label><input id="newEmailIn" type="email" placeholder="new@email.com"></div>
  <div class="form-row"><label>${t("currentPassword")}</label><input id="emailPw" type="password"></div>
  <button class="btn" id="saveEmail">${t("saveChanges")}</button>`;
}
function secPrivacy(u) {
  const rows = [["profilePublic", t("privProfilePublic")], ["showFav", t("privShowFav")], ["trainerContact", t("privTrainerContact")], ["shareData", t("privShareData")]];
  return `<h3>${t("privacy")}</h3><div class="h-sub">&nbsp;</div>` + rows.map(([k, l]) => toggleRow("priv", k, l, u.privacy[k])).join("");
}
function secNotif(u) {
  const rows = [["offers", t("notifOffers")], ["expiry", t("notifExpiry")], ["classes", t("notifClass")], ["news", t("notifNews")]];
  return `<h3>${t("notifications")}</h3><div class="h-sub">&nbsp;</div>` + rows.map(([k, l]) => toggleRow("notif", k, l, u.notif[k])).join("");
}
function secPrefs() {
  const L = state.lang === "ar";
  return `<h3>${t("preferences")}</h3><div class="h-sub">&nbsp;</div>
  <div class="form-row"><label>${t("theme")}</label>
    <div class="seg">
      <button data-pref-theme="light" class="${state.theme === "light" ? "active" : ""}">☀️ ${L ? "فاتح" : "Light"}</button>
      <button data-pref-theme="dark" class="${state.theme === "dark" ? "active" : ""}">🌙 ${L ? "داكن" : "Dark"}</button>
    </div></div>
  <div class="form-row"><label>${t("language")}</label>
    <div class="seg">
      <button data-pref-lang="en" class="${state.lang === "en" ? "active" : ""}">English</button>
      <button data-pref-lang="ar" class="${state.lang === "ar" ? "active" : ""}">العربية</button>
    </div></div>
  <div class="form-row"><label>${t("currency")}</label>
    <select id="prefCurrency">${Object.keys(CURRENCIES).map(k => `<option value="${k}"${state.currency === k ? " selected" : ""}>${k} — ${CURRENCIES[k][state.lang]}</option>`).join("")}</select></div>`;
}
function secDanger() {
  return `<h3 style="color:#ef4444">${t("dangerZone")}</h3><div class="h-sub">${t("deleteWarn")}</div>
  <div class="danger-box">
    <div style="font-weight:700;margin-bottom:8px">${t("deleteAccount")}</div>
    <button class="danger-btn" id="deleteAcct">${t("deleteAccount")}</button>
  </div>`;
}

/* ---------- 2FA / secrets ---------- */
function genSecret() {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let s = "";
  for (let i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)];
  return s.match(/.{1,4}/g).join(" ");
}
function genRecovery() {
  const h = "0123456789abcdef";
  const part = () => Array.from({ length: 4 }, () => h[Math.floor(Math.random() * 16)]).join("");
  return Array.from({ length: 8 }, () => part() + "-" + part());
}
function qrSVG(seed) {
  const n = 23, cell = 5;
  let hh = 0; for (const c of seed) hh = (hh * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { hh = (hh * 1103515245 + 12345) >>> 0; return (hh >>> 16) & 1; };
  const finder = (x, y) => {
    for (const [bx, by] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      if (x >= bx && x < bx + 7 && y >= by && y < by + 7) {
        const lx = x - bx, ly = y - by;
        return { in: true, on: (lx === 0 || lx === 6 || ly === 0 || ly === 6) || (lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4) };
      }
    }
    return { in: false };
  };
  let r = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const f = finder(x, y);
    const on = f.in ? f.on : rnd();
    if (on) r += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`;
  }
  return `<svg class="qr" viewBox="0 0 ${n * cell} ${n * cell}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/><g fill="#111">${r}</g></svg>`;
}
function start2FA() {
  tempSecret = genSecret();
  document.getElementById("twoFABlock").innerHTML = `
    <div class="qr-box">
      ${qrSVG(tempSecret)}
      <div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${t("scanCode")}</div>
        <div class="secret">${tempSecret}</div>
      </div>
    </div>
    <div class="form-row"><label>${t("enterCode")}</label><input id="code2fa" inputmode="numeric" maxlength="6" placeholder="123456"></div>
    <button class="btn" id="verify2fa">${t("verify")}</button>`;
}
function verify2FA() {
  const code = val("code2fa").trim();
  if (!/^\d{6}$/.test(code)) return toast(t("codeInvalid"));
  updateUser({ twoFA: true, twoFASecret: tempSecret, recovery: genRecovery() });
  toast(t("twoFAOn")); reRenderSection();
}
function disable2FA() {
  updateUser({ twoFA: false, twoFASecret: null, recovery: [] });
  toast(t("twoFAOff")); reRenderSection();
}
function addPasskey() { updateUser({ passkeys: currentUser().passkeys + 1 }); toast(t("saved")); reRenderSection(); }

/* ---------- actions ---------- */
function afterAuth() {
  renderAll();
  if (typeof startReminderScheduler === "function") startReminderScheduler();
  const u = currentUser();
  if (u && u.role === "owner" && typeof openFeature === "function") {
    closeAuth();
    openFeature("owner"); // the owner dashboard lives on the front page
  } else if (u && typeof isStaffRole === "function" && isStaffRole(u.role)) {
    openAuth("account"); // lands on the role's portal (see openAuth default section)
  } else {
    closeAuth();
    // member without a plan yet -> continue the onboarding questions
    if (u && typeof onboardingMaybeResume === "function") onboardingMaybeResume(u);
  }
  if (u) toast(`${t("hi")}, ${u.name.split(" ")[0]} 👋`);
}

async function handleSignIn() {
  const email = val("inEmail").trim().toLowerCase(), pw = val("inPassword");
  if (!email || !pw) return showErr(t("fillAll"));
  let u = getUsers().find(x => x.email === email);
  if ((!u || u.pw !== obf(pw)) && window.GymoraCloud) {
    // Not on this device (or password changed elsewhere) — try the cloud account.
    const r = await GymoraCloud.login(email, pw);
    if (r && r.profile) {
      const users = getUsers().filter(x => x.email !== email);
      users.push(r.profile); saveUsers(users);
      u = r.profile;
    }
  }
  if (!u || u.pw !== obf(pw)) return showErr(t("badLogin"));
  if (u.banned) return showErr(t("bannedMsg"));
  const wantRole = val("inRoleSignin") || "user";
  if ((u.role || "user") !== wantRole) return showErr(t("roleMismatch").replace("{role}", roleLabel(u.role || "user")));
  setSession(email);
  if (window.GymoraCloud && !GymoraCloud.hasSession()) GymoraCloud.login(email, pw); // background: refresh cloud session
  if (!u.verified) return startVerify();
  afterAuth();
}
async function handleSignUp() {
  const name = val("inName").trim(), email = val("inEmail").trim().toLowerCase();
  const ageStr = val("inAge"), age = parseInt(ageStr, 10), pw = val("inPassword"), cf = val("inConfirm");
  const agree = document.getElementById("agreeAge").checked;
  const role = val("inRole") || "user", gymId = val("inGym") || null;
  const needsKey = role === "coach" || role === "staff" || role === "owner";
  const phone = val("inPhone").trim();
  const accessKey = window.GymoraKeys ? GymoraKeys.normalize(val("inAccessKey")) : val("inAccessKey").trim().toUpperCase();
  if (!name || !email || !ageStr || !pw) return showErr(t("fillAll"));
  if (!validEmail(email)) return showErr(t("emailInvalid"));
  if (!(age >= 12 && age <= 100)) return showErr(t("ageInvalid"));
  if (!agree) return showErr(t("ageInvalid"));
  if (pw.length < 6) return showErr(t("pwShort"));
  if (pw !== cf) return showErr(t("pwMismatch"));
  if (needsKey && !phone) return showErr(t("phoneMissing"));
  if (needsKey && !accessKey) return showErr(t("accessKeyMissing"));
  if (getUsers().some(x => x.email === email)) return showErr(t("emailTaken"));

  if (needsKey) {
    /* The access key decides the role and gym. The backend is the
       real validator (keys are usually generated on another device);
       this browser's AES store is the offline/prototype fallback. */
    let grantedRole = null, grantedGym = null, offline = false;
    if (window.GymoraCloud) {
      const r = await GymoraCloud.signupWithKey(email, pw, { name, email, age, phone, role, gymId, verified: false, banned: false }, accessKey);
      if (r.ok) { grantedRole = (r.profile && r.profile.role) || role; grantedGym = (r.profile && r.profile.gymId) || gymId; }
      else if (r.offline) offline = true;
      else return showErr(r.error || t("accessKeyBad"));
    } else offline = true;
    if (offline) {
      const rec = window.GymoraKeys ? await GymoraKeys.consume(accessKey, role, email) : null;
      if (!rec) return showErr(t("accessKeyBad"));
      grantedRole = rec.role; grantedGym = rec.gymId || gymId;
    }
    const nu = createUser({ name, email, age, pw, phone, role: grantedRole, gymId: grantedGym });
    setSession(email);
    if (window.GymoraCloud) GymoraCloud.pushSoon(nu); // background: sync the full profile
    return startVerify();
  }

  const nu = createUser({ name, email, age, pw, role, gymId }); setSession(email);
  if (window.GymoraCloud) GymoraCloud.signup(email, pw, nu); // background: create the cloud account
  startVerify();
}
function handleGoogle() {
  const email = "demo.user@gmail.com";
  let u = getUsers().find(x => x.email === email);
  if (!u) u = createUser({ name: "Demo User", email, age: 25, verified: true }, "google");
  setSession(email); afterAuth();
}

/* ---------- account verification ----------
   The server generates the code and emails it (Brevo). Without an
   email service configured — or offline / from file:// — the code is
   shown on screen exactly like the old demo. */
let pendingCode = null;   // demo code shown on screen (offline / no email service)
let cloudVerify = false;  // true when the server holds the code
function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
async function startVerify() {
  pendingCode = null; cloudVerify = false;
  authView = "verify"; renderAuthView(); // show the screen immediately
  if (window.GymoraCloud && GymoraCloud.hasSession()) {
    const r = await GymoraCloud.verifySend();
    if (r.ok && r.data) {
      if (r.data.already) { updateUser({ verified: true }); toast(t("verifiedMsg")); return afterAuth(); }
      cloudVerify = true;
      pendingCode = r.data.sent ? null : (r.data.demoCode || null);
      if (authView === "verify") renderAuthView();
      return;
    }
    if (!r.offline) {
      // server reachable but declined to send a new code (e.g. 60s
      // resend cooldown) — the previously emailed code is still valid,
      // so stay in cloud mode rather than inventing a local code the
      // server would reject.
      cloudVerify = true;
      pendingCode = null;
      if (authView === "verify") renderAuthView();
      return;
    }
  }
  pendingCode = genCode(); // truly offline / no backend — on-screen demo code
  if (authView === "verify") renderAuthView();
}
function verifyHTML() {
  const u = currentUser();
  const box = pendingCode
    ? `<div class="verify-demo">${t("verifyDemo")} <b>${pendingCode}</b></div>`
    : cloudVerify
      ? `<div class="note" style="margin-bottom:12px">📧 ${t("verifySentTo")} <b>${esc(u ? u.email : "")}</b></div>`
      : `<div class="note" style="margin-bottom:12px">⏳</div>`;
  return `
  <button class="auth-x" id="authX">✕</button>
  <div class="auth-title">${t("verifyTitle")}</div>
  <div class="auth-sub">${t("verifySub")}</div>
  <div class="form-err" id="authErr"></div>
  ${box}
  <div class="form-row"><label>${t("verifyCodeLabel")}</label><input id="verifyCode" inputmode="numeric" maxlength="6" placeholder="123456"></div>
  <button class="btn block" id="doVerify">${t("verifyBtn")}</button>
  <div class="auth-foot"><button class="auth-link" id="resendCode">${t("verifyResend")}</button></div>`;
}
async function doVerify() {
  const code = (val("verifyCode") || "").trim();
  if (cloudVerify) {
    const r = await GymoraCloud.verifyConfirm(code);
    if (r.ok) { updateUser({ verified: true }); pendingCode = null; toast(t("verifiedMsg")); return afterAuth(); }
    return showErr(r.offline ? t("verifyNet") : (r.data && r.data.error) || t("verifyBad"));
  }
  if (code !== pendingCode) return showErr(t("verifyBad"));
  updateUser({ verified: true }); pendingCode = null; toast(t("verifiedMsg")); afterAuth();
}
function resendCode() { startVerify(); toast(t("verifyResend")); }
function doLogout() { clearSession(); if (window.GymoraCloud) GymoraCloud.logout(); closeAuth(); renderAll(); toast(t("signOut")); }

function saveProfile() {
  const name = val("pfName").trim(), age = parseInt(val("pfAge"), 10);
  if (!name) return toast(t("fillAll"));
  if (!(age >= 12 && age <= 100)) return toast(t("ageInvalid"));
  updateUser({ name, age, city: val("pfCity").trim(), gender: val("pfGender"), goal: val("pfGoal") });
  renderAuthButton(); renderAuthView(); toast(t("profileUpdated"));
}
function changePassword() {
  const u = currentUser();
  if (u.pw !== obf(val("curPw"))) return toast(t("wrongCurrent"));
  const np = val("newPw"), cf = val("confPw");
  if (np.length < 6) return toast(t("pwShort"));
  if (np !== cf) return toast(t("pwMismatch"));
  updateUser({ pw: obf(np) }); reRenderSection(); toast(t("passwordUpdated"));
}
function changeEmail() {
  const u = currentUser(), ne = val("newEmailIn").trim().toLowerCase();
  if (!validEmail(ne)) return toast(t("emailInvalid"));
  if (u.pw !== obf(val("emailPw"))) return toast(t("wrongCurrent"));
  if (getUsers().some(x => x.email === ne && x.id !== u.id)) return toast(t("emailTaken"));
  updateUser({ email: ne }); setSession(ne); renderAuthView(); toast(t("emailUpdated"));
}
function askDelete() {
  const box = document.querySelector("#acctBody .danger-box");
  box.innerHTML = `<div style="font-weight:700;margin-bottom:8px;color:#ef4444">${t("deleteWarn")}</div>
    <button class="danger-btn" id="confirmDelete">${t("confirmDelete")}</button>
    <button class="btn ghost" id="cancelDelete" style="margin-inline-start:8px">${t("cancel")}</button>`;
}
function doDelete() {
  saveUsers(getUsers().filter(x => x.email !== getSession()));
  clearSession(); closeAuth(); renderAll(); toast(t("deleteAccount"));
}
function setPref(kind, value) {
  if (kind === "theme") state.theme = value;
  if (kind === "accent") state.accent = value;
  if (kind === "lang") state.lang = value;
  persist(); applyChrome(); renderControls();
  if (kind === "lang") { renderStaticText(); renderFilters(); renderResults(); renderAuthView(); }
  else reRenderSection();
}

/* ---------- event routing ---------- */
function onAuthClick(e) {
  const hit = (s) => e.target.closest(s);
  if (typeof handlePremiumClick === "function" && handlePremiumClick(e)) return;
  if (typeof handleLibClick === "function" && handleLibClick(e)) return;
  if (typeof handlePlanClick === "function" && handlePlanClick(e)) return;
  if (typeof handleFoodClick === "function" && handleFoodClick(e)) return;
  if (typeof handlePortalClick === "function" && handlePortalClick(e)) return;
  if (typeof handleEngageClick === "function" && handleEngageClick(e)) return;
  if (typeof handleRankClick === "function" && handleRankClick(e)) return;
  if (typeof handleWorkoutClick === "function" && handleWorkoutClick(e)) return;
  if (typeof handleShopClick === "function" && handleShopClick(e)) return;
  if (hit("#acctBack")) { acctSection = "menu"; renderAuthView(); return; }
  const ssb = hit("[data-secsub]");
  if (ssb) { secSub = ssb.dataset.secsub; reRenderSection(); return; }
  if (hit("#doVerify")) return doVerify();
  if (hit("#resendCode")) return resendCode();
  if (hit("#authX")) return closeAuth();
  if (hit("#toSignUp")) return openAuth("signup");
  if (hit("#toSignIn")) return openAuth("signin");
  if (hit("#googleBtn")) return handleGoogle();
  if (hit("#doSignIn")) return handleSignIn();
  if (hit("#doSignUp")) return handleSignUp();
  if (hit("#forgotPw")) return toast(state.lang === "ar" ? "إعادة تعيين كلمة المرور تأتي مع الخادم (المرحلة 2)" : "Password reset arrives with the backend (Phase 2)");
  if (hit("#signOutBtn")) return doLogout();
  const sec = hit("[data-sec]"); if (sec) return switchSection(sec.dataset.sec);
  if (hit("#saveProfile")) return saveProfile();
  if (hit("#removeAvatar")) { updateUser({ avatar: null }); renderAuthButton(); renderAuthView(); return toast(t("saved")); }
  if (hit("#addWeight")) return addWeight();
  const dw = hit("[data-delw]"); if (dw) return delWeight(dw.dataset.delw);
  if (hit("#savePw")) return changePassword();
  if (hit("#saveEmail")) return changeEmail();
  if (hit("#enable2fa")) return start2FA();
  if (hit("#verify2fa")) return verify2FA();
  if (hit("#disable2fa")) return disable2FA();
  if (hit("#faceIdBtn")) return void biometricSignIn();
  if (hit("#setupBio")) return void setupBiometric();
  if (hit("#removeBio")) return removeBiometric();
  if (hit("#deleteAcct")) return askDelete();
  if (hit("#confirmDelete")) return doDelete();
  if (hit("#cancelDelete")) return switchSection("danger");
  const pt = hit("[data-pref-theme]"); if (pt) return setPref("theme", pt.dataset.prefTheme);
  const pa = hit("[data-pref-accent]"); if (pa) return setPref("accent", pa.dataset.prefAccent);
  const pl = hit("[data-pref-lang]"); if (pl) return setPref("lang", pl.dataset.prefLang);
}
function onAuthChange(e) {
  if (e.target.id === "inRole") {
    const needsKey = ["coach", "staff", "owner"].includes(e.target.value);
    const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? "" : "none"; };
    show("phoneRow", needsKey); show("accessKeyRow", needsKey); show("gymRow", !needsKey);
    return;
  }
  if (e.target.id === "inRoleSignin") {
    const el = document.getElementById("signinKeyHint");
    if (el) el.style.display = ["coach", "staff", "owner"].includes(e.target.value) ? "" : "none";
    return;
  }
  if (typeof handleLibChange === "function" && handleLibChange(e)) return;
  if (typeof handlePortalChange === "function" && handlePortalChange(e)) return;
  if (typeof handlePlanChange === "function" && handlePlanChange(e)) return;
  if (typeof handleFoodChange === "function" && handleFoodChange(e)) return;
  if (typeof handleEngageChange === "function" && handleEngageChange(e)) return;
  if (typeof handleRankChange === "function" && handleRankChange(e)) return;
  if (e.target.id === "avatarInput") {
    const file = e.target.files && e.target.files[0];
    if (file) resizeImage(file, 256, (dataUrl) => {
      if (!dataUrl) return toast("⚠️");
      try { updateUser({ avatar: dataUrl }); } catch (err) { return toast("⚠️"); }
      renderAuthButton(); renderAuthView(); toast(t("saved"));
    });
    return;
  }
  const priv = e.target.dataset.priv, notif = e.target.dataset.notif;
  if (priv) { const p = { ...currentUser().privacy }; p[priv] = e.target.checked; updateUser({ privacy: p }); return toast(t("saved")); }
  if (notif) { const n = { ...currentUser().notif }; n[notif] = e.target.checked; updateUser({ notif: n }); return toast(t("saved")); }
  if (e.target.id === "prefCurrency") { state.currency = e.target.value; persist(); renderAll(); return reRenderSection(); }
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const back = document.getElementById("authBack");
  back.addEventListener("click", (e) => { if (e.target.id === "authBack") closeAuth(); });
  const modal = document.getElementById("authModal");
  modal.addEventListener("click", onAuthClick);
  modal.addEventListener("change", onAuthChange);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && back.classList.contains("open")) closeAuth(); });
  renderAuthButton();
});

/* ---------- deep links: /admin, /coach, /owner, /staff ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const seg = location.pathname.replace(/\/+$/, "").split("/").pop().toLowerCase();
  if (!["coach", "owner", "staff"].includes(seg)) return;
  const u = currentUser();
  if (u) {
    if (u.role === "owner" && typeof openFeature === "function") openFeature("owner");
    else openAuth("account"); // lands on the signed-in user's own portal
  } else {
    openAuth("signin");
    const sel = document.getElementById("inRoleSignin");
    if (sel) { sel.value = seg; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  }
});
