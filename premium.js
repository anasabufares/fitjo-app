/* =============================================================
   GYMORA — Premium subscription (prototype checkout)
   Gates "My plan" and the workout tracker behind a paid
   subscription: weekly / monthly ($10) / yearly, plus a
   one-time 3-day free trial. Payment is simulated — real
   checkout via a licensed Jordanian processor arrives with
   the backend.
   Relies on globals: state, t, I18N, currentUser, updateUser,
   toast, reRenderSection, fmtPrice, CURRENCIES, fmtDate.
   ============================================================= */

const PM_I18N = {
  en: {
    pmTitle: "GYMORA Premium",
    pmSub: "Unlock your personal plan and the workout tracker.",
    pmFeat1: "Personal workout plan — built for men and women differently",
    pmFeat2: "Meals, calories, water and supplements matched to your goal",
    pmFeat3: "Workout tracker — log every set, see your progress",
    pmFeat4: "Weekly gym schedule with smart reminders",
    pmWeekly: "Weekly", pmMonthly: "Monthly", pmYearly: "Yearly",
    pmPerWeek: "/ week", pmPerMonth: "/ month", pmPerYear: "/ year",
    pmPopular: "Most popular", pmBestValue: "Save 50%",
    pmChoose: "Choose",
    pmTrialBtn: "Start 3-day free trial 🎁",
    pmTrialNote: "No card needed. One trial per account.",
    pmTrialStarted: "Your 3-day free trial has started 🎉",
    pmTrialDone: "Your free trial has ended — pick a plan to keep your plan & workouts.",
    pmExpired: "Your subscription has ended — renew to keep your plan & workouts.",
    pmConfirmTitle: "Confirm subscription",
    pmActivate: "Activate (demo)",
    pmDemoNote: "Prototype: payment is simulated for now. Real checkout (card, CliQ, e-wallets) arrives with the backend.",
    pmActive: "Premium active 🎉",
    pmStatusTrial: "Free trial", pmDaysLeft: "days left", pmDayLeft: "day left",
    pmRenew: "Renew",
    pmSeePlanTrial: "Start free trial & see my plan 🎁",
  },
  ar: {
    pmTitle: "GYMORA بريميوم",
    pmSub: "افتح خطتك الشخصية ومتتبّع التمارين.",
    pmFeat1: "خطة تمارين شخصية — مبنية بشكل مختلف للرجال والنساء",
    pmFeat2: "وجبات وسعرات وماء ومكملات حسب هدفك",
    pmFeat3: "متتبّع التمارين — سجّل كل مجموعة وتابع تقدمك",
    pmFeat4: "جدول أسبوعي للنادي مع تذكيرات ذكية",
    pmWeekly: "أسبوعي", pmMonthly: "شهري", pmYearly: "سنوي",
    pmPerWeek: "/ أسبوع", pmPerMonth: "/ شهر", pmPerYear: "/ سنة",
    pmPopular: "الأكثر شيوعاً", pmBestValue: "وفّر 50%",
    pmChoose: "اختر",
    pmTrialBtn: "ابدأ تجربة مجانية 3 أيام 🎁",
    pmTrialNote: "لا حاجة لبطاقة. تجربة واحدة لكل حساب.",
    pmTrialStarted: "بدأت تجربتك المجانية لـ 3 أيام 🎉",
    pmTrialDone: "انتهت تجربتك المجانية — اختر خطة للاحتفاظ بخطتك وتمارينك.",
    pmExpired: "انتهى اشتراكك — جدّد للاحتفاظ بخطتك وتمارينك.",
    pmConfirmTitle: "تأكيد الاشتراك",
    pmActivate: "تفعيل (تجريبي)",
    pmDemoNote: "نموذج أولي: الدفع محاكى حالياً. الدفع الحقيقي (بطاقة، كليك، محافظ إلكترونية) يأتي مع الخادم.",
    pmActive: "بريميوم مفعّل 🎉",
    pmStatusTrial: "تجربة مجانية", pmDaysLeft: "أيام متبقية", pmDayLeft: "يوم متبقٍ",
    pmRenew: "تجديد",
    pmSeePlanTrial: "ابدأ التجربة المجانية واعرض خطتي 🎁",
  },
};
Object.assign(I18N.en, PM_I18N.en);
Object.assign(I18N.ar, PM_I18N.ar);

/* prices are set in USD ($10/month headline) and converted to the
   selected currency through the app's JOD-based rates */
const PREMIUM_PLANS = {
  weekly:  { usd: 3,  days: 7 },
  monthly: { usd: 10, days: 30 },
  yearly:  { usd: 60, days: 365 },
};
const pmJOD = (usd) => usd / CURRENCIES.USD.rate;
const pmPrice = (key) => fmtPrice(pmJOD(PREMIUM_PLANS[key].usd));
const pmLabel = (key) => ({ weekly: t("pmWeekly"), monthly: t("pmMonthly"), yearly: t("pmYearly"), trial: t("pmStatusTrial") }[key]);
const pmPer = (key) => ({ weekly: t("pmPerWeek"), monthly: t("pmPerMonth"), yearly: t("pmPerYear") }[key]);

let pmSelected = null; // plan key on the confirm step

/* ---------- state ---------- */
function premiumActive(u) { return !!(u && u.sub && u.sub.until > Date.now()); }
function pmDaysLeft(u) { return Math.max(1, Math.ceil((u.sub.until - Date.now()) / 86400000)); }

function premiumStartTrial() {
  const now = Date.now();
  updateUser({ sub: { plan: "trial", since: now, until: now + 3 * 86400000 }, trialUsed: true });
  toast(t("pmTrialStarted"));
}
function premiumSubscribe(key) {
  const p = PREMIUM_PLANS[key]; if (!p) return;
  const now = Date.now();
  updateUser({ sub: { plan: key, since: now, until: now + p.days * 86400000 } });
  toast(t("pmActive"));
}

/* ---------- gate: wraps the plan / workouts sections ---------- */
function gatePremium(u, renderFn) {
  if (premiumActive(u)) return pmStatusChip(u) + renderFn(u);
  return paywallHTML(u);
}
function pmStatusChip(u) {
  const d = pmDaysLeft(u);
  return `<div class="pm-chip">⭐ ${t("pmTitle")} · ${pmLabel(u.sub.plan)} · ${d} ${d === 1 ? t("pmDayLeft") : t("pmDaysLeft")}</div>`;
}

/* ---------- paywall ---------- */
function paywallHTML(u) {
  if (pmSelected) return pmConfirmHTML(u);
  const expiredMsg = u.sub && u.sub.until <= Date.now()
    ? `<div class="form-err show" style="position:static;margin-bottom:10px">${u.sub.plan === "trial" ? t("pmTrialDone") : t("pmExpired")}</div>` : "";
  const cards = [
    ["weekly", "", ""],
    ["monthly", "popular", t("pmPopular")],
    ["yearly", "best", t("pmBestValue")],
  ].map(([key, cls, badge]) => `
    <button class="pm-card ${cls}" data-pmplan="${key}">
      ${badge ? `<span class="pm-badge">${badge}</span>` : ""}
      <div class="pm-name">${pmLabel(key)}</div>
      <div class="pm-price">${pmPrice(key)}</div>
      <div class="pm-per">${pmPer(key)}</div>
      <div class="btn sm pm-go">${t("pmChoose")}</div>
    </button>`).join("");
  return `
  <div class="pm-lock">🔒</div>
  <h3 style="text-align:center">⭐ ${t("pmTitle")}</h3>
  <div class="h-sub" style="text-align:center">${t("pmSub")}</div>
  ${expiredMsg}
  <div class="pm-feats">
    ${[t("pmFeat1"), t("pmFeat2"), t("pmFeat3"), t("pmFeat4")].map(f => `<div class="pm-feat">✅ <span>${f}</span></div>`).join("")}
  </div>
  <div class="pm-cards">${cards}</div>
  ${!u.trialUsed ? `
    <button class="btn ghost block" id="pmTrial" style="margin-top:12px">${t("pmTrialBtn")}</button>
    <div class="note" style="text-align:center">${t("pmTrialNote")}</div>` : ""}
  <div class="note">💳 ${t("pmDemoNote")}</div>`;
}
function pmConfirmHTML(u) {
  const key = pmSelected;
  return `
  <h3>${t("pmConfirmTitle")}</h3>
  <div class="h-sub">⭐ ${t("pmTitle")}</div>
  <div class="section">
    <div class="kv"><span>${pmLabel(key)}</span><span><b>${pmPrice(key)}</b> ${pmPer(key)}</span></div>
  </div>
  <button class="btn block" id="pmConfirm">${t("pmActivate")}</button>
  <button class="btn ghost block" id="pmCancel" style="margin-top:8px">${t("cancel")}</button>
  <div class="note">💳 ${t("pmDemoNote")}</div>`;
}

/* ---------- events (routed from onAuthClick) ---------- */
function handlePremiumClick(e) {
  const hit = (s) => e.target.closest(s);
  const card = hit("[data-pmplan]");
  if (card) { pmSelected = card.dataset.pmplan; reRenderSection(); return true; }
  if (hit("#pmTrial")) { premiumStartTrial(); reRenderSection(); return true; }
  if (hit("#pmConfirm")) { premiumSubscribe(pmSelected); pmSelected = null; reRenderSection(); return true; }
  if (hit("#pmCancel")) { pmSelected = null; reRenderSection(); return true; }
  return false;
}
function resetPremium() { pmSelected = null; }
