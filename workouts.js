/* =============================================================
   GYMORA — workout tracker
   Build today's session exercise by exercise, log every set
   (weight x reps), finish to save. Suggests what to train today
   from the user's plan/goal. History with total volume.
   Relies on globals: state, t, I18N, currentUser, updateUser,
   reRenderSection, toast, esc, val, toLb, fmtDate,
   EXERCISES + exName (rank.js), WK/buildWeek/splitFor (plan.js).
   ============================================================= */

const WT_I18N = {
  en: {
    workouts: "Workout tracker",
    wtSub: "Log your session set by set — weight and reps for every exercise.",
    wtSuggested: "Suggested today",
    wtSession: "Today's session",
    wtAddExercise: "Add exercise",
    wtSet: "Set", wtAddSet: "Add set",
    wtNoSession: "No exercises yet — add one below to start your session.",
    wtFinish: "Finish workout", wtSaved: "Workout saved 💪",
    wtNeedSet: "Log at least one set first.",
    wtBadSet: "Enter a weight and reps for the set.",
    wtHistory: "History",
    wtNoHistory: "No workouts yet. Your finished sessions appear here.",
    wtVolume: "volume", wtSets: "sets", wtExercises: "exercises",
    wtRest: "Rest day on your plan — light session or recovery 😌",
  },
  ar: {
    workouts: "متتبّع التمارين",
    wtSub: "سجّل جلستك مجموعة بمجموعة — الوزن والتكرارات لكل تمرين.",
    wtSuggested: "المقترح اليوم",
    wtSession: "جلسة اليوم",
    wtAddExercise: "أضف تمريناً",
    wtSet: "مجموعة", wtAddSet: "أضف مجموعة",
    wtNoSession: "لا تمارين بعد — أضف واحداً بالأسفل لتبدأ جلستك.",
    wtFinish: "إنهاء التمرين", wtSaved: "حُفظ التمرين 💪",
    wtNeedSet: "سجّل مجموعة واحدة على الأقل أولاً.",
    wtBadSet: "أدخل وزناً وتكرارات للمجموعة.",
    wtHistory: "السجل",
    wtNoHistory: "لا تمارين بعد. تظهر جلساتك المنتهية هنا.",
    wtVolume: "الحجم", wtSets: "مجموعات", wtExercises: "تمارين",
    wtRest: "يوم راحة حسب خطتك — جلسة خفيفة أو تعافٍ 😌",
  },
};
Object.assign(I18N.en, WT_I18N.en);
Object.assign(I18N.ar, WT_I18N.ar);

/* current unsaved session: [{ key, sets: [{kg, reps}] }] */
let wSess = [];

/* what should this user train today? (from their plan, else their goal) */
function wtSuggestion(u) {
  try {
    if (u.intake && typeof buildWeek === "function") {
      const day = buildWeek(u)[jordanDayIndex(new Date())];
      if (day.rest) return { rest: true };
      return { name: WK[day.workout].name[state.lang], ex: WK[day.workout].ex.map(x => x.n[state.lang]) };
    }
    if (typeof splitFor === "function" && typeof WK !== "undefined") {
      const key = splitFor(u.goal || "fit", 3)[0];
      return { name: WK[key].name[state.lang], ex: WK[key].ex.map(x => x.n[state.lang]) };
    }
  } catch (e) { /* plan module absent */ }
  return null;
}

function secWorkouts(u) {
  const sugg = wtSuggestion(u);
  const suggBox = sugg ? `
    <div class="section">
      <h4>💡 ${t("wtSuggested")}</h4>
      ${sugg.rest ? `<div class="note">${t("wtRest")}</div>` : `
      <div class="pr-meta" style="margin-bottom:6px">${esc(sugg.name)}</div>
      <div class="chips">${sugg.ex.map(n => `<span class="chip">${esc(n)}</span>`).join("")}</div>`}
    </div>` : "";

  const sessionBlocks = wSess.length ? wSess.map((it, i) => `
    <div class="wk-block">
      <div class="wk-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>${EXERCISES[it.key] ? EXERCISES[it.key].emoji : "🏋️"} ${exName(it.key)}</span>
        <button class="auth-link fr-del" data-delex="${i}">✕</button>
      </div>
      ${it.sets.map((s, j) => `
        <div class="ex-row"><span>${t("wtSet")} ${j + 1}</span>
          <span class="ex-sets">${s.kg} kg · ${toLb(s.kg)} lb × ${s.reps}
            <button class="auth-link fr-del" data-delset="${i}-${j}">✕</button></span></div>`).join("")}
      <div class="ws-addset">
        <input id="wKg${i}" type="number" step="0.5" min="0" placeholder="kg" class="control">
        <input id="wReps${i}" type="number" step="1" min="1" max="50" placeholder="reps" class="control">
        <button class="btn ghost sm" data-addset="${i}">＋ ${t("wtAddSet")}</button>
      </div>
    </div>`).join("") : `<div class="note">${t("wtNoSession")}</div>`;

  const history = (u.workouts || []).slice().reverse().slice(0, 12);
  const histRows = history.length ? history.map(w => {
    const sets = w.items.reduce((a, x) => a + x.sets.length, 0);
    return `<div class="kv"><span>${fmtDate(w.date)}</span>
      <span>${w.items.length} ${t("wtExercises")} · ${sets} ${t("wtSets")} · <b>${Math.round(w.volume)}</b> kg ${t("wtVolume")}</span></div>`;
  }).join("") : `<div class="note">${t("wtNoHistory")}</div>`;

  return `
  <h3>📋 ${t("workouts")}</h3>
  <div class="h-sub">${t("wtSub")}</div>
  ${suggBox}
  <div class="section">
    <h4>🔥 ${t("wtSession")}</h4>
    ${sessionBlocks}
    <div class="ws-addex">
      <select id="wEx">${Object.keys(EXERCISES).map(k => `<option value="${k}">${EXERCISES[k].emoji} ${exName(k)}</option>`).join("")}</select>
      <button class="btn ghost" id="wAddEx">＋ ${t("wtAddExercise")}</button>
    </div>
    ${wSess.length ? `<button class="btn block" id="wFinish" style="margin-top:12px">✅ ${t("wtFinish")}</button>` : ""}
  </div>
  <div class="section"><h4>📆 ${t("wtHistory")}</h4>${histRows}</div>`;
}

/* ---------- actions ---------- */
function wtAddSet(i) {
  const kg = parseFloat(val("wKg" + i)), reps = parseInt(val("wReps" + i), 10);
  if (!(kg > 0) || !(reps >= 1)) return toast(t("wtBadSet"));
  wSess[i].sets.push({ kg: Math.round(kg * 10) / 10, reps: Math.min(reps, 50) });
  reRenderSection();
}
function wtFinish() {
  const items = wSess.filter(x => x.sets.length);
  if (!items.length) return toast(t("wtNeedSet"));
  const volume = items.reduce((a, x) => a + x.sets.reduce((b, s) => b + s.kg * s.reps, 0), 0);
  const u = currentUser();
  updateUser({ workouts: (u.workouts || []).concat([{ date: Date.now(), items, volume }]) });
  wSess = [];
  reRenderSection();
  toast(t("wtSaved"));
}
function handleWorkoutClick(e) {
  const hit = (s) => e.target.closest(s);
  if (hit("#wAddEx")) { wSess.push({ key: val("wEx"), sets: [] }); reRenderSection(); return true; }
  const as = hit("[data-addset]"); if (as) { wtAddSet(parseInt(as.dataset.addset, 10)); return true; }
  const ds = hit("[data-delset]");
  if (ds) {
    const [i, j] = ds.dataset.delset.split("-").map(Number);
    if (wSess[i]) { wSess[i].sets.splice(j, 1); reRenderSection(); }
    return true;
  }
  const de = hit("[data-delex]"); if (de) { wSess.splice(parseInt(de.dataset.delex, 10), 1); reRenderSection(); return true; }
  if (hit("#wFinish")) { wtFinish(); return true; }
  return false;
}
