/* =============================================================
   GYMORA — onboarding wizard
   Opens when the app starts. Asks one question at a time:
   sign in / sign up -> gender -> age -> height -> weight ->
   target -> goal -> experience -> days -> activity -> time ->
   diet, then builds the personal plan (workouts differ for
   men and women — see splitFor in plan.js).
   Relies on globals: state, t, I18N, currentUser, getUsers,
   createUser, setSession, updateUser, validEmail, esc, toast,
   renderAll, openAuth, openFeature, switchSection.
   ============================================================= */

const OB_I18N = {
  en: {
    obWelcomeTitle: "Welcome to GYMORA 👋",
    obWelcomeSub: "Answer a few quick questions — one at a time — and we'll build your personal workout, meal and water plan.",
    obSignUp: "I'm new — create my account", obSignIn: "I have an account — sign in",
    obBrowse: "Just browsing gyms for now",
    obContinue: "Continue", obStepOf: "Question {a} of {b}",
    obQName: "What's your name?", obNamePh: "Your full name",
    obQEmail: "What's your email?",
    obQAge: "How old are you?", obAgeSub: "We use it to calculate your calories.",
    obQPassword: "Create a password", obPwSub: "At least 6 characters.", obPw2Ph: "Repeat the password",
    obQGender: "Are you a man or a woman?",
    obGenderSub: "Your workout plan is built differently for men and women.",
    obMan: "Man", obWoman: "Woman", obGenderNA: "Prefer not to say",
    obQHeight: "How tall are you?", obHeightSub: "In centimeters.",
    obQWeight: "What's your current weight?", obWeightSub: "In kilograms.",
    obQTarget: "What's your target weight?", obTargetSub: "In kilograms — you can skip this.",
    obQGoal: "What's your main goal?",
    obQExp: "How experienced are you in the gym?",
    obQDays: "How many days a week will you train?",
    obQActivity: "How active is your normal day?",
    obQTime: "When do you prefer to train?",
    obQDiet: "Any diet preference?",
    obSkipStep: "Skip",
    obBuilding: "Building your plan…",
    obDoneTitle: "Your plan is ready 🎉",
    obDoneSubM: "A men's training split, meals, water and a weekly schedule — built just for you.",
    obDoneSubF: "A women's training split (glutes & lower-body focus), meals, water and a weekly schedule — built just for you.",
    obDoneSubNA: "Workouts, meals, water and a weekly schedule — built just for you.",
    obSeePlan: "See my plan", obLater: "Maybe later",
  },
  ar: {
    obWelcomeTitle: "أهلاً بك في GYMORA 👋",
    obWelcomeSub: "أجب عن أسئلة سريعة — سؤالاً واحداً في كل مرة — ونبني لك خطة التمارين والوجبات والماء الخاصة بك.",
    obSignUp: "أنا جديد — أنشئ حسابي", obSignIn: "لدي حساب — تسجيل الدخول",
    obBrowse: "أتصفح الأندية فقط الآن",
    obContinue: "متابعة", obStepOf: "سؤال {a} من {b}",
    obQName: "ما اسمك؟", obNamePh: "اسمك الكامل",
    obQEmail: "ما بريدك الإلكتروني؟",
    obQAge: "كم عمرك؟", obAgeSub: "نستخدمه لحساب سعراتك.",
    obQPassword: "أنشئ كلمة مرور", obPwSub: "6 أحرف على الأقل.", obPw2Ph: "أعد كتابة كلمة المرور",
    obQGender: "هل أنت رجل أم امرأة؟",
    obGenderSub: "تُبنى خطة التمارين بشكل مختلف للرجال والنساء.",
    obMan: "رجل", obWoman: "امرأة", obGenderNA: "أفضّل عدم القول",
    obQHeight: "كم طولك؟", obHeightSub: "بالسنتيمتر.",
    obQWeight: "كم وزنك الحالي؟", obWeightSub: "بالكيلوغرام.",
    obQTarget: "كم وزنك المستهدف؟", obTargetSub: "بالكيلوغرام — يمكنك تخطي هذا.",
    obQGoal: "ما هدفك الأساسي؟",
    obQExp: "ما مستوى خبرتك في النادي؟",
    obQDays: "كم يوماً ستتمرن في الأسبوع؟",
    obQActivity: "ما مدى نشاط يومك المعتاد؟",
    obQTime: "متى تفضّل التمرين؟",
    obQDiet: "هل لديك نظام غذائي مفضّل؟",
    obSkipStep: "تخطي",
    obBuilding: "نبني خطتك…",
    obDoneTitle: "خطتك جاهزة 🎉",
    obDoneSubM: "برنامج تمارين للرجال، وجبات، ماء وجدول أسبوعي — مبني خصيصاً لك.",
    obDoneSubF: "برنامج تمارين للنساء (تركيز على المؤخرة والجزء السفلي)، وجبات، ماء وجدول أسبوعي — مبني خصيصاً لك.",
    obDoneSubNA: "تمارين، وجبات، ماء وجدول أسبوعي — مبني خصيصاً لك.",
    obSeePlan: "عرض خطتي", obLater: "لاحقاً",
  },
};
Object.assign(I18N.en, OB_I18N.en);
Object.assign(I18N.ar, OB_I18N.ar);

/* ---------- state ---------- */
let obOpen = false;
let obStep = "welcome";   // "welcome" | a step key | "done"
let obFlow = [];          // ordered step keys for this run
let obData = {};          // collected answers

const OB_SKIP_KEY = "gym_obSkip";

/* ---------- step definitions ---------- */
function obChoiceSteps() {
  return {
    gender: {
      q: t("obQGender"), sub: t("obGenderSub"), two: true,
      opts: [["m", "👨", t("obMan")], ["f", "👩", t("obWoman")]],
      extra: `<button class="auth-link" id="obGenderNA">${t("obGenderNA")}</button>`,
    },
    goal: {
      q: t("obQGoal"),
      opts: [["lose", "🔥", t("goalLose")], ["build", "💪", t("goalBuild")], ["gain", "🍚", t("goalGain")], ["recomp", "⚖️", t("goalRecomp")], ["fit", "✨", t("goalFit")]],
    },
    experience: {
      q: t("obQExp"),
      opts: [["beginner", "🌱", t("expBeginner")], ["intermediate", "🏃", t("expIntermediate")], ["advanced", "🏆", t("expAdvanced")]],
    },
    days: {
      q: t("obQDays"), two: true,
      opts: [2, 3, 4, 5, 6].map(n => [String(n), "📅", String(n)]),
    },
    activity: {
      q: t("obQActivity"),
      opts: [["sedentary", "🪑", t("actSedentary")], ["light", "🚶", t("actLight")], ["moderate", "🏃", t("actModerate")], ["active", "⚡", t("actActive")], ["very", "🔥", t("actVery")]],
    },
    gymTime: {
      q: t("obQTime"),
      opts: [["morning", "🌅", t("timeMorning")], ["afternoon", "☀️", t("timeAfternoon")], ["evening", "🌙", t("timeEvening")]],
    },
    diet: {
      q: t("obQDiet"),
      opts: [["none", "🍽️", t("dietNone")], ["veg", "🥗", t("dietVeg")], ["vegan", "🌱", t("dietVegan")]],
    },
  };
}
function obInputSteps() {
  return {
    name:     { q: t("obQName"), type: "text", ph: t("obNamePh") },
    email:    { q: t("obQEmail"), type: "email", ph: "you@email.com" },
    age:      { q: t("obQAge"), sub: t("obAgeSub"), type: "number", ph: "25", min: 12, max: 100, err: t("ageInvalid") },
    password: { q: t("obQPassword"), sub: t("obPwSub"), type: "password", ph: "••••••••" },
    height:   { q: t("obQHeight"), sub: t("obHeightSub"), type: "number", ph: "170", min: 120, max: 230, unit: "cm", err: t("formErr") },
    weight:   { q: t("obQWeight"), sub: t("obWeightSub"), type: "number", ph: "75", min: 30, max: 300, unit: "kg", step: 0.1, err: t("formErr") },
    target:   { q: t("obQTarget"), sub: t("obTargetSub"), type: "number", ph: "70", min: 30, max: 300, unit: "kg", step: 0.1, optional: true },
  };
}

function obBuildFlow() {
  const steps = [];
  if (!currentUser()) steps.push("name", "email", "age", "password", "gender");
  else steps.push("gender", "age");
  steps.push("height", "weight", "target", "goal", "experience", "days", "activity", "gymTime", "diet");
  return steps;
}

/* ---------- open / close ---------- */
function obContainer() {
  let el = document.getElementById("obBack");
  if (!el) {
    el = document.createElement("div");
    el.id = "obBack";
    el.className = "ob-back";
    document.body.appendChild(el);
    el.addEventListener("click", obClick);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && obStep !== "welcome" && obStep !== "done") { e.preventDefault(); obNext(); }
    });
  }
  return el;
}
function startOnboarding(from) {
  obData = {};
  obFlow = obBuildFlow();
  obStep = from === "plan" ? obFlow[0] : "welcome";
  // pre-fill what we already know about a signed-in member
  const u = currentUser();
  if (u) {
    if (u.gender && u.gender !== "na") obData.gender = u.gender;
    if (u.age) obData.age = u.age;
  }
  obOpen = true;
  obContainer().classList.add("open");
  document.body.style.overflow = "hidden";
  obRender();
}
function closeOnboarding(remember) {
  obOpen = false;
  const el = document.getElementById("obBack");
  if (el) el.classList.remove("open");
  document.body.style.overflow = "";
  if (remember) sessionStorage.setItem(OB_SKIP_KEY, "1");
}

/* ---------- rendering ---------- */
function obRender() {
  const el = obContainer();
  if (obStep === "welcome") { el.innerHTML = obWelcomeHTML(); return; }
  if (obStep === "done") { el.innerHTML = obDoneHTML(); return; }

  const idx = obFlow.indexOf(obStep), total = obFlow.length;
  const pct = Math.round(((idx + 1) / total) * 100);
  const label = t("obStepOf").replace("{a}", idx + 1).replace("{b}", total);
  const choices = obChoiceSteps(), inputs = obInputSteps();
  const c = choices[obStep], inp = inputs[obStep];

  let body = "", showNext = false;
  if (c) {
    body = `
      <div class="ob-opts ${c.two ? "two" : ""}">
        ${c.opts.map(([v, ico, l]) => `
          <button class="ob-opt ${obData[obStep] === v ? "on" : ""}" data-obopt="${v}">
            <span class="ob-ico">${ico}</span>${l}
          </button>`).join("")}
      </div>
      ${c.extra || ""}`;
  } else if (inp) {
    const v = obData[obStep] != null ? obData[obStep] : "";
    body = `
      <div class="ob-inwrap">
        <input class="ob-input" id="obIn" type="${inp.type}" placeholder="${inp.ph}"
          value="${esc(v)}" ${inp.min != null ? `min="${inp.min}" max="${inp.max}"` : ""} ${inp.step ? `step="${inp.step}"` : ""}
          ${inp.type === "email" ? 'autocomplete="email"' : ""} ${inp.type === "password" ? 'autocomplete="new-password"' : ""}>
        ${inp.unit ? `<span class="ob-unit">${inp.unit}</span>` : ""}
      </div>
      ${obStep === "password" ? `<div class="ob-inwrap"><input class="ob-input" id="obIn2" type="password" placeholder="${t("obPw2Ph")}" autocomplete="new-password"></div>` : ""}`;
    showNext = true;
  }

  el.innerHTML = `
  <div class="ob-card">
    <div class="ob-top">
      <button class="ob-nav" id="obPrev" ${idx === 0 && currentUser() ? 'style="visibility:hidden"' : ""}>‹</button>
      <div class="ob-progress"><span style="width:${pct}%"></span></div>
      <button class="ob-nav" id="obClose">✕</button>
    </div>
    <div class="ob-steplabel">${label}</div>
    <h2 class="ob-q">${(c && c.q) || (inp && inp.q) || ""}</h2>
    ${(c && c.sub) || (inp && inp.sub) ? `<div class="ob-sub">${(c && c.sub) || inp.sub}</div>` : ""}
    <div class="form-err" id="obErr"></div>
    ${body}
    ${showNext ? `<button class="btn block" id="obNext">${t("obContinue")}</button>` : ""}
    ${inp && inp.optional ? `<button class="auth-link block-center" id="obSkipStep">${t("obSkipStep")}</button>` : ""}
  </div>`;
  const first = document.getElementById("obIn");
  if (first) setTimeout(() => first.focus(), 50);
}

function obWelcomeHTML() {
  return `
  <div class="ob-card ob-center">
    <img src="logo-mark.png" alt="" width="72" height="72" style="margin:0 auto 10px;display:block">
    <h2 class="ob-q" style="text-align:center">${t("obWelcomeTitle")}</h2>
    <div class="ob-sub" style="text-align:center">${t("obWelcomeSub")}</div>
    <div class="ob-opts">
      <button class="ob-opt" id="obGoSignup"><span class="ob-ico">🚀</span>${t("obSignUp")}</button>
      <button class="ob-opt" id="obGoSignin"><span class="ob-ico">👋</span>${t("obSignIn")}</button>
    </div>
    <button class="auth-link block-center" id="obGoBrowse">${t("obBrowse")}</button>
  </div>`;
}

function obDoneHTML() {
  const g = obData.gender;
  const sub = g === "f" ? t("obDoneSubF") : g === "m" ? t("obDoneSubM") : t("obDoneSubNA");
  const u = currentUser();
  const offerTrial = typeof premiumActive === "function" && u && !premiumActive(u) && !u.trialUsed;
  return `
  <div class="ob-card ob-center">
    <div style="font-size:64px;text-align:center">${g === "f" ? "🏋️‍♀️" : "🏋️"}</div>
    <h2 class="ob-q" style="text-align:center">${t("obDoneTitle")}</h2>
    <div class="ob-sub" style="text-align:center">${sub}</div>
    <button class="btn block" id="${offerTrial ? "obTrialPlan" : "obSeePlan"}">${offerTrial ? t("pmSeePlanTrial") : t("obSeePlan")}</button>
    ${offerTrial ? `<div class="note" style="text-align:center">${t("pmTrialNote")}</div>` : ""}
    <button class="auth-link block-center" id="obLater">${t("obLater")}</button>
  </div>`;
}

/* ---------- navigation + validation ---------- */
function obErr(msg) { const el = document.getElementById("obErr"); if (el) { el.textContent = msg; el.classList.add("show"); } }

function obValidate() {
  const inp = obInputSteps()[obStep];
  if (!inp) return true;
  const raw = (val("obIn") || "").trim();
  if (inp.optional && !raw) { obData[obStep] = null; return true; }
  if (inp.type === "number") {
    const n = parseFloat(raw);
    if (!(n >= inp.min && n <= inp.max)) { obErr(inp.err || t("fillAll")); return false; }
    obData[obStep] = n;
    return true;
  }
  if (obStep === "name") {
    if (!raw) { obErr(t("fillAll")); return false; }
    obData.name = raw; return true;
  }
  if (obStep === "email") {
    const email = raw.toLowerCase();
    if (!validEmail(email)) { obErr(t("emailInvalid")); return false; }
    if (getUsers().some(x => x.email === email)) { obErr(t("emailTaken")); return false; }
    obData.email = email; return true;
  }
  if (obStep === "password") {
    const pw = val("obIn"), cf = val("obIn2");
    if (pw.length < 6) { obErr(t("pwShort")); return false; }
    if (pw !== cf) { obErr(t("pwMismatch")); return false; }
    obData.password = pw; return true;
  }
  obData[obStep] = raw;
  return true;
}
function obNext() {
  if (!obValidate()) return;
  const idx = obFlow.indexOf(obStep);
  if (idx === obFlow.length - 1) return obFinish();
  obStep = obFlow[idx + 1];
  obRender();
}
function obPrev() {
  const idx = obFlow.indexOf(obStep);
  if (idx <= 0) {
    if (!currentUser()) { obStep = "welcome"; obRender(); }
    return;
  }
  obStep = obFlow[idx - 1];
  obRender();
}

/* ---------- finish: create the account (if new) + build the plan ---------- */
function obFinish() {
  const d = obData;
  let u = currentUser();
  if (!u) {
    u = createUser({ name: d.name, email: d.email, age: d.age, pw: d.password, verified: true });
    setSession(d.email);
    if (window.GymoraCloud) GymoraCloud.signup(d.email, d.password, u); // background: cloud account
  }
  const intake = {
    height: d.height, weight: d.weight, target: d.target || null, goal: d.goal,
    experience: d.experience, daysPerWeek: parseInt(d.days, 10), activity: d.activity,
    gymTime: d.gymTime, diet: d.diet,
  };
  const r = u.reminders || { gym: { on: false, time: "19:00" }, rest: { on: false, time: "10:00" } };
  r.gym.time = { morning: "07:00", afternoon: "16:00", evening: "19:00" }[d.gymTime] || "19:00";
  const patch = { gender: d.gender || "na", age: d.age || u.age, goal: d.goal, intake, reminders: r };
  if (!(u.weights && u.weights.length)) patch.weights = [{ date: Date.now(), kg: Math.round(d.weight * 10) / 10 }];
  updateUser(patch);
  if (typeof renderAll === "function") renderAll();
  if (typeof startReminderScheduler === "function") startReminderScheduler();
  obStep = "done";
  obRender();
}

/* ---------- events ---------- */
function obClick(e) {
  const hit = (s) => e.target.closest(s);
  if (hit("#obGoSignup")) { obStep = obFlow[0]; obRender(); return; }
  if (hit("#obGoSignin")) { closeOnboarding(false); openAuth("signin"); return; }
  if (hit("#obGoBrowse") || hit("#obClose")) { closeOnboarding(true); return; }
  if (hit("#obPrev")) return obPrev();
  if (hit("#obNext")) return obNext();
  if (hit("#obSkipStep")) { obData[obStep] = null; return obNext(); }
  if (hit("#obGenderNA")) { obData.gender = "na"; return obNext(); }
  const opt = hit("[data-obopt]");
  if (opt) { obData[obStep] = opt.dataset.obopt; return obNext(); }
  if (hit("#obTrialPlan")) {
    premiumStartTrial();
    closeOnboarding(true);
    if (typeof openAuth === "function") { openAuth("account"); switchSection("plan"); }
    return;
  }
  if (hit("#obSeePlan")) {
    closeOnboarding(true);
    toast(t("planReady"));
    if (typeof openAuth === "function") { openAuth("account"); switchSection("plan"); }
    return;
  }
  if (hit("#obLater")) { closeOnboarding(true); toast(t("planReady")); return; }
}

/* called by afterAuth (auth.js) once a member signs in */
function onboardingMaybeResume(u) {
  if (!u || (u.role || "user") !== "user" || u.intake) return false;
  startOnboarding("plan");
  return true;
}

/* ---------- boot: open on app start ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem(OB_SKIP_KEY)) return;
  // skip on staff deep links (/coach, /owner, /staff) — they use the classic sign-in
  const seg = location.pathname.replace(/\/+$/, "").split("/").pop().toLowerCase();
  if (["coach", "owner", "staff", "admin"].includes(seg)) return;
  const u = currentUser();
  if (!u) startOnboarding("welcome");
  else if ((u.role || "user") === "user" && !u.intake) startOnboarding("plan");
});
