/* =============================================================
   FitJo — engagement: gym check-in points + rewards + InBody scan
   -------------------------------------------------------------
   DEMO NOW, REAL-AI-READY (same pattern as the calorie tracker).
   - Photo gym check-in: an AI decides "real gym" vs "just a photo"
     and awards points. Miss a day -> points are deducted.
   - Redeem points for cafeteria / sportswear offers & free stuff.
   - InBody scan: photo of an InBody sheet -> body metrics logged.

   Turn on real AI later by setting (before scripts run):
     window.FITJO_CONFIG = {
       gymEndpoint: "/.netlify/functions/verify-gym",
       inbodyEndpoint: "/.netlify/functions/scan-inbody"
     };
   Relies on globals: state, t, I18N, currentUser, updateUser,
   reRenderSection, toast, esc, fmtDate, todayKey, fmtPrice, toLb.
   ============================================================= */

const ENGAGE_I18N = {
  en: {
    pointsRewards: "Points & rewards", inbodyScan: "InBody scan",
    pointsTitle: "Points & rewards", pointsSub: "Check in at the gym to earn points. Miss a day and you lose some.",
    yourPoints: "Your points", checkinsCount: "Check-ins", streakDays: "This week",
    checkinTitle: "Check in at the gym", checkinCta: "📸 Take a gym photo to check in",
    checkinHint: "AI verifies you're really at a gym — no screenshots.",
    checkinChecking: "Verifying your gym photo…",
    checkedInMsg: "Checked in! +{n} points 💪", fakeGymMsg: "Couldn't verify a real gym — try a clear photo inside the gym.",
    alreadyMsg: "You already checked in today ✅", pointsLost: "{n} points deducted for missed days",
    rewardsTitle: "Rewards", rewardsSub: "Redeem your points for free stuff.",
    redeem: "Redeem", pts: "pts", notEnough: "Not enough points yet.",
    redeemedMsg: "Redeemed! Show this code at the counter: {code}", owned: "Redeemed ✓",
    recentCheckins: "Recent check-ins", noCheckins: "No check-ins yet. Snap a gym photo to start earning.",
    verifiedGym: "Verified gym", real: "match",
    inbodyTitle: "InBody scan", inbodySub: "Snap a photo of your InBody sheet — we read it and log your body data.",
    inbodyCta: "📸 Scan an InBody sheet", inbodyHint: "Point at the printed results page.",
    inbodyChecking: "Reading your InBody sheet…",
    weight: "Weight", bodyFat: "Body fat", muscle: "Muscle mass", bmi: "BMI", visceral: "Visceral fat",
    inbodyLogged: "InBody scan logged 🧬", inbodyHistory: "History", noInbody: "No scans yet. Scan a sheet to log your body data.",
    demoNote: "Demo mode: results are simulated so it works offline. Real photo AI turns on when connected to the cloud (see AI-SETUP).",
  },
  ar: {
    pointsRewards: "النقاط والمكافآت", inbodyScan: "فحص InBody",
    pointsTitle: "النقاط والمكافآت", pointsSub: "سجّل حضورك في النادي لتكسب نقاطاً. تفوّت يوماً فتخسر بعضها.",
    yourPoints: "نقاطك", checkinsCount: "مرات الحضور", streakDays: "هذا الأسبوع",
    checkinTitle: "سجّل حضورك في النادي", checkinCta: "📸 التقط صورة في النادي لتسجيل الحضور",
    checkinHint: "يتحقق الذكاء الاصطناعي أنك فعلاً في نادٍ — بلا لقطات شاشة.",
    checkinChecking: "نتحقّق من صورة النادي…",
    checkedInMsg: "تم تسجيل الحضور! +{n} نقطة 💪", fakeGymMsg: "تعذّر التحقق من نادٍ حقيقي — جرّب صورة واضحة داخل النادي.",
    alreadyMsg: "سجّلت حضورك اليوم بالفعل ✅", pointsLost: "خُصمت {n} نقطة لأيام الغياب",
    rewardsTitle: "المكافآت", rewardsSub: "استبدل نقاطك بهدايا مجانية.",
    redeem: "استبدال", pts: "نقطة", notEnough: "النقاط غير كافية بعد.",
    redeemedMsg: "تم الاستبدال! اعرض هذا الرمز عند الكاونتر: {code}", owned: "مُستبدل ✓",
    recentCheckins: "الحضور الأخير", noCheckins: "لا حضور بعد. التقط صورة في النادي لتبدأ الكسب.",
    verifiedGym: "نادٍ موثّق", real: "تطابق",
    inbodyTitle: "فحص InBody", inbodySub: "صوّر ورقة InBody الخاصة بك — نقرأها ونسجّل بيانات جسمك.",
    inbodyCta: "📸 امسح ورقة InBody", inbodyHint: "وجّه الكاميرا نحو صفحة النتائج المطبوعة.",
    inbodyChecking: "نقرأ ورقة InBody…",
    weight: "الوزن", bodyFat: "نسبة الدهون", muscle: "الكتلة العضلية", bmi: "مؤشر الكتلة", visceral: "الدهون الحشوية",
    inbodyLogged: "تم تسجيل فحص InBody 🧬", inbodyHistory: "السجل", noInbody: "لا فحوصات بعد. امسح ورقة لتسجيل بياناتك.",
    demoNote: "الوضع التجريبي: النتائج محاكاة لتعمل دون إنترنت. يعمل تحليل الصور بالذكاء الاصطناعي عند الربط بالسحابة (راجع AI-SETUP).",
  },
};
Object.assign(I18N.en, ENGAGE_I18N.en);
Object.assign(I18N.ar, ENGAGE_I18N.ar);

/* Earning is deliberately slow: ~7-10 pts per verified visit, -5 per missed
   day. Rewards keep their prices, so a free shake ≈ a month of training. */
const CHECKIN_POINTS = 10;
const MISS_PENALTY = 5;

/* rewards catalogue */
const REWARDS = [
  { key: "preworkout", emoji: "⚡", cost: 100, name: { en: "Free pre-workout", ar: "بري وورك آوت مجاني" }, from: { en: "Gym café", ar: "كافيه النادي" } },
  { key: "shake", emoji: "🥤", cost: 300, name: { en: "Free protein shake", ar: "بروتين شيك مجاني" }, from: { en: "Gym café", ar: "كافيه النادي" } },
  { key: "sportswear10", emoji: "👕", cost: 500, name: { en: "20% off sportswear", ar: "خصم 20% على الملابس الرياضية" }, from: { en: "Sports shop", ar: "متجر رياضي" } },
  { key: "tshirt", emoji: "🎽", cost: 800, name: { en: "Free FitJo T-shirt", ar: "تيشيرت FitJo مجاني" }, from: { en: "Sports shop", ar: "متجر رياضي" } },
  { key: "shoes", emoji: "👟", cost: 1500, name: { en: "30% off running shoes", ar: "خصم 30% على أحذية الجري" }, from: { en: "Sports shop", ar: "متجر رياضي" } },
  { key: "month", emoji: "🎟️", cost: 2500, name: { en: "3 months free membership", ar: "3 أشهر عضوية مجانية" }, from: { en: "Your gym", ar: "ناديك" } },
];

/* transient scan state */
let nCheck = { status: "idle" };   // idle | checking
let nBody = { status: "idle" };    // idle | checking

/* ---------- points logic ---------- */
function reconcilePoints(u) {
  const today = todayKey();
  if (u.pointsThru === today) return false;
  const dates = u.checkinDates || [];
  let deducted = 0;
  if (dates.length) {
    const last = dates[dates.length - 1];
    const missed = Math.max(0, Math.floor((new Date(today) - new Date(last)) / 86400000) - 1);
    if (missed > 0) { deducted = missed * MISS_PENALTY; }
  }
  const patch = { pointsThru: today };
  if (deducted > 0) patch.points = Math.max(0, (u.points || 0) - deducted);
  updateUser(patch);
  if (deducted > 0) toast(t("pointsLost").replace("{n}", deducted));
  return deducted > 0;
}

function fileToB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}
function hashFile(file) {
  let h = 0; const s = (file.name || "") + "|" + file.size + "|" + (file.lastModified || 0);
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/* ---------- the "brain": real-AI-ready gym verify ---------- */
function demoVerifyGym(file) {
  return new Promise(res => {
    const h = hashFile(file);
    const real = (h % 5) !== 0;               // ~80% look like a real gym in demo
    const confidence = 70 + (h % 28);         // 70–97
    setTimeout(() => res({ real, confidence }), 800);
  });
}
async function verifyGym(file) {
  const cfg = window.FITJO_CONFIG || {};
  if (cfg.gymEndpoint) {
    try {
      const image_base64 = await fileToB64(file);
      const r = await fetch(cfg.gymEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_base64, mime: file.type }) });
      if (r.ok) { const d = await r.json(); if (typeof d.real === "boolean") return { real: d.real, confidence: Math.round(d.confidence || 80) }; }
    } catch (e) { /* fall back */ }
  }
  return demoVerifyGym(file);
}

/* ---------- the "brain": real-AI-ready InBody read ---------- */
function demoScanInbody(file, u) {
  return new Promise(res => {
    const h = hashFile(file);
    const baseW = (u.weights && u.weights.length) ? u.weights[u.weights.length - 1].kg : (u.intake && u.intake.weight) || 75;
    const cm = (u.intake && u.intake.height) || 175;
    const weightKg = Math.round((baseW + ((h % 30) - 15) / 10) * 10) / 10;
    const bodyFat = 12 + (h % 180) / 10;                 // 12–30%
    const bmi = Math.round((weightKg / ((cm / 100) ** 2)) * 10) / 10;
    const muscle = Math.round((weightKg * (1 - bodyFat / 100) * 0.55) * 10) / 10;
    const visceral = 4 + (h % 90) / 10;                  // 4–13
    setTimeout(() => res({
      date: Date.now(), weightKg, bodyFat: Math.round(bodyFat * 10) / 10,
      muscle, bmi, visceral: Math.round(visceral * 10) / 10,
    }), 900);
  });
}
async function scanInbody(file, u) {
  const cfg = window.FITJO_CONFIG || {};
  if (cfg.inbodyEndpoint) {
    try {
      const image_base64 = await fileToB64(file);
      const r = await fetch(cfg.inbodyEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_base64, mime: file.type }) });
      if (r.ok) { const d = await r.json(); if (d && d.weightKg != null) return { date: Date.now(), ...d }; }
    } catch (e) { /* fall back */ }
  }
  return demoScanInbody(file, u);
}

/* ---------- points & rewards section ---------- */
function secPoints(u) {
  reconcilePoints(u); u = currentUser();
  const pts = u.points || 0;
  const dates = u.checkinDates || [];
  const weekStart = todayKey(new Date(Date.now() - 6 * 86400000));
  const thisWeek = dates.filter(d => d >= weekStart).length;
  const redeemed = u.redeemed || [];
  const checking = nCheck.status === "checking";
  const checkCard = checking
    ? `<div class="section ct-scan"><div class="ct-analyzing" style="position:static;background:none;color:var(--text)"><span class="ct-spin" style="border-color:var(--border);border-top-color:var(--accent)"></span>${t("checkinChecking")}</div></div>`
    : `<div class="section">
        <h4>📍 ${t("checkinTitle")}</h4>
        <label class="ct-photobtn" for="checkinInput">${t("checkinCta")}</label>
        <input id="checkinInput" type="file" accept="image/*" capture="environment" data-engage="checkin" hidden>
        <div class="note">${t("checkinHint")}</div>
      </div>`;
  return `
  <h3>🏅 ${t("pointsTitle")}</h3>
  <div class="h-sub">${t("pointsSub")}</div>
  <div class="stat-row">
    <div class="stat"><div class="n" style="color:var(--accent)">${pts}</div><div class="l">${t("yourPoints")}</div></div>
    <div class="stat"><div class="n">${dates.length}</div><div class="l">${t("checkinsCount")}</div></div>
    <div class="stat"><div class="n">${thisWeek}</div><div class="l">${t("streakDays")}</div></div>
  </div>
  ${checkCard}
  <div class="section">
    <h4>🎁 ${t("rewardsTitle")}</h4>
    <div class="h-sub">${t("rewardsSub")}</div>
    <div class="reward-grid">
      ${REWARDS.map(r => {
        const owned = redeemed.includes(r.key);
        const can = pts >= r.cost && !owned;
        return `<div class="reward-card ${owned ? "owned" : ""}">
          <div class="rw-ico">${r.emoji}</div>
          <div class="rw-name">${r.name[state.lang]}</div>
          <div class="rw-from">${r.from[state.lang]}</div>
          <div class="rw-cost">${r.cost} ${t("pts")}</div>
          <button class="btn ${can ? "" : "ghost"}" data-redeem="${r.key}" ${owned ? "disabled" : ""}>${owned ? t("owned") : t("redeem")}</button>
        </div>`;
      }).join("")}
    </div>
  </div>
  <div class="section">
    <h4>🗓️ ${t("recentCheckins")}</h4>
    ${dates.length
      ? dates.slice().reverse().slice(0, 10).map(d => `<div class="kv"><span>✅ ${t("verifiedGym")}</span><span>${histDate(d)}</span></div>`).join("")
      : `<div class="note">${t("noCheckins")}</div>`}
  </div>
  <div class="note">${t("demoNote")}</div>`;
}

/* ---------- InBody section ---------- */
function metric(label, value, unit) { return `<div class="stat"><div class="n" style="font-size:18px">${value}<small> ${unit}</small></div><div class="l">${label}</div></div>`; }
function secInbody(u) {
  const log = u.inbody || [];
  const latest = log.length ? log[log.length - 1] : null;
  const checking = nBody.status === "checking";
  const scanCard = checking
    ? `<div class="section ct-scan"><div class="ct-analyzing" style="position:static;background:none;color:var(--text)"><span class="ct-spin" style="border-color:var(--border);border-top-color:var(--accent)"></span>${t("inbodyChecking")}</div></div>`
    : `<div class="section">
        <label class="ct-photobtn" for="inbodyInput">${t("inbodyCta")}</label>
        <input id="inbodyInput" type="file" accept="image/*" capture="environment" data-engage="inbody" hidden>
        <div class="note">${t("inbodyHint")}</div>
      </div>`;
  return `
  <h3>🧬 ${t("inbodyTitle")}</h3>
  <div class="h-sub">${t("inbodySub")}</div>
  ${latest ? `
    <div class="stat-row" style="flex-wrap:wrap">
      ${metric(t("weight"), latest.weightKg, "kg")}
      ${metric(t("bodyFat"), latest.bodyFat, "%")}
      ${metric(t("muscle"), latest.muscle, "kg")}
    </div>
    <div class="stat-row" style="flex-wrap:wrap">
      ${metric(t("bmi"), latest.bmi, "")}
      ${metric(t("visceral"), latest.visceral, "")}
      ${metric(t("weight"), toLb(latest.weightKg), "lb")}
    </div>` : ""}
  ${scanCard}
  <div class="section">
    <h4>📈 ${t("inbodyHistory")}</h4>
    ${log.length
      ? log.slice().reverse().map(e => `<div class="kv"><span>${fmtDate(e.date)}</span><span>${e.weightKg} kg · ${e.bodyFat}% ${t("bodyFat")} · ${e.muscle} kg ${t("muscle")}</span></div>`).join("")
      : `<div class="note">${t("noInbody")}</div>`}
  </div>
  <div class="note">${t("demoNote")}</div>`;
}

/* ---------- actions ---------- */
function doCheckin(file) {
  const u = currentUser(); if (!u) return;
  const today = todayKey();
  if ((u.checkinDates || []).includes(today)) { toast(t("alreadyMsg")); return; }
  nCheck.status = "checking"; reRenderSection();
  verifyGym(file).then(r => {
    nCheck.status = "idle";
    if (!r.real) { reRenderSection(); toast(t("fakeGymMsg")); return; }
    const award = Math.max(5, Math.round(CHECKIN_POINTS * (r.confidence / 100)));
    const cur = currentUser();
    const dates = (cur.checkinDates || []).concat([today]);
    updateUser({ points: (cur.points || 0) + award, checkinDates: dates, lastCheckin: today, pointsThru: today });
    reRenderSection();
    toast(t("checkedInMsg").replace("{n}", award));
  }).catch(() => { nCheck.status = "idle"; reRenderSection(); toast("⚠️"); });
}
function doRedeem(key) {
  const u = currentUser(); const r = REWARDS.find(x => x.key === key); if (!u || !r) return;
  if ((u.redeemed || []).includes(key)) return;
  if ((u.points || 0) < r.cost) { toast(t("notEnough")); return; }
  const code = "FJ-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  updateUser({ points: u.points - r.cost, redeemed: (u.redeemed || []).concat([key]) });
  reRenderSection();
  toast(t("redeemedMsg").replace("{code}", code));
}
function doInbody(file) {
  const u = currentUser(); if (!u) return;
  nBody.status = "checking"; reRenderSection();
  scanInbody(file, u).then(res => {
    nBody.status = "idle";
    const cur = currentUser();
    updateUser({ inbody: (cur.inbody || []).concat([res]) });
    reRenderSection();
    toast(t("inbodyLogged"));
  }).catch(() => { nBody.status = "idle"; reRenderSection(); toast("⚠️"); });
}

/* ---------- hooks called by auth.js ---------- */
function handleEngageClick(e) {
  const hit = (s) => e.target.closest(s);
  const rd = hit("[data-redeem]"); if (rd) { doRedeem(rd.dataset.redeem); return true; }
  return false;
}
function handleEngageChange(e) {
  const el = e.target;
  if (el.dataset.engage === "checkin") { const f = el.files && el.files[0]; if (f) doCheckin(f); return true; }
  if (el.dataset.engage === "inbody") { const f = el.files && el.files[0]; if (f) doInbody(f); return true; }
  return false;
}
