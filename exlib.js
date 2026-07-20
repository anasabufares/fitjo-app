/* =============================================================
   GYMORA — exercise library
   Every exercise ever: 873 exercises (free-exercise-db, public
   domain) with photos, step-by-step instructions, muscle groups,
   equipment and difficulty. Search + filters + detail view.
   Data (exlib-data.js, ~750 KB) is injected on first open so the
   app itself stays fast.
   Relies on globals: state, t, I18N, esc, exVidId (videos.js).
   ============================================================= */

const EXLIB_IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

const LIB_I18N = {
  en: {
    libTitle: "Exercise library", catLibrary: "Exercises",
    libSub: "873 exercises — every muscle, every machine. Search, filter, learn the form.",
    libSearch: "Search exercises… (e.g. squat, biceps, cable)",
    libMuscle: "Muscle", libEquip: "Equipment", libLevel: "Level", libAll: "All",
    libResults: "exercises", libShowMore: "Show more", libNone: "No exercises match — clear a filter or try another word.",
    libPrimary: "Primary muscles", libSecondary: "Secondary muscles",
    libHow: "How to do it", libWatch: "Watch video guide", libSearchYT: "Find video on YouTube",
    libLoading: "Loading the exercise library…",
    libBack: "All exercises",
    libAddWorkout: "Add to today's workout",
    libAdded: "Added — it's in your Workout tracker 📋",
    libNeedPremium: "The workout tracker is a Premium feature — start your free trial from My plan.",
    lvl_beginner: "Beginner", lvl_intermediate: "Intermediate", lvl_expert: "Expert",
    mus_quadriceps: "Quads", mus_shoulders: "Shoulders", mus_abdominals: "Abs", mus_chest: "Chest",
    mus_hamstrings: "Hamstrings", mus_triceps: "Triceps", mus_biceps: "Biceps", mus_lats: "Lats",
    "mus_middle back": "Middle back", mus_calves: "Calves", "mus_lower back": "Lower back",
    mus_forearms: "Forearms", mus_glutes: "Glutes", mus_traps: "Traps", mus_adductors: "Adductors",
    mus_abductors: "Abductors", mus_neck: "Neck",
    eq_barbell: "Barbell", eq_dumbbell: "Dumbbell", eq_cable: "Cable", eq_machine: "Machine",
    "eq_body only": "Bodyweight", eq_kettlebells: "Kettlebell", eq_bands: "Bands",
    "eq_medicine ball": "Medicine ball", "eq_exercise ball": "Exercise ball",
    "eq_foam roll": "Foam roller", "eq_e-z curl bar": "EZ bar", eq_other: "Other",
  },
  ar: {
    libTitle: "مكتبة التمارين", catLibrary: "التمارين",
    libSub: "873 تمريناً — كل عضلة وكل جهاز. ابحث وصفِّ وتعلّم الأداء الصحيح.",
    libSearch: "ابحث عن تمرين… (مثل squat أو biceps)",
    libMuscle: "العضلة", libEquip: "المعدات", libLevel: "المستوى", libAll: "الكل",
    libResults: "تمرين", libShowMore: "عرض المزيد", libNone: "لا توجد تمارين مطابقة — أزل فلتراً أو جرّب كلمة أخرى.",
    libPrimary: "العضلات الأساسية", libSecondary: "العضلات المساعدة",
    libHow: "طريقة الأداء", libWatch: "شاهد فيديو الشرح", libSearchYT: "ابحث عن فيديو على يوتيوب",
    libLoading: "نحمّل مكتبة التمارين…",
    libBack: "كل التمارين",
    libAddWorkout: "أضِف إلى تمرين اليوم",
    libAdded: "أُضيف — تجده في متتبّع التمارين 📋",
    libNeedPremium: "متتبّع التمارين ميزة بريميوم — ابدأ تجربتك المجانية من خطتي.",
    lvl_beginner: "مبتدئ", lvl_intermediate: "متوسط", lvl_expert: "متقدم",
    mus_quadriceps: "فخذ أمامي", mus_shoulders: "أكتاف", mus_abdominals: "بطن", mus_chest: "صدر",
    mus_hamstrings: "فخذ خلفي", mus_triceps: "ترايسبس", mus_biceps: "بايسبس", mus_lats: "لاتس",
    "mus_middle back": "وسط الظهر", mus_calves: "سمانة", "mus_lower back": "أسفل الظهر",
    mus_forearms: "ساعد", mus_glutes: "مؤخرة", mus_traps: "ترابيس", mus_adductors: "مقربات الفخذ",
    mus_abductors: "مبعدات الفخذ", mus_neck: "رقبة",
    eq_barbell: "بار", eq_dumbbell: "دمبل", eq_cable: "كيبل", eq_machine: "جهاز",
    "eq_body only": "وزن الجسم", eq_kettlebells: "كيتلبل", eq_bands: "أحزمة مطاطية",
    "eq_medicine ball": "كرة طبية", "eq_exercise ball": "كرة تمارين",
    "eq_foam roll": "رول فوم", "eq_e-z curl bar": "بار EZ", eq_other: "أخرى",
  },
};
Object.assign(I18N.en, LIB_I18N.en);
Object.assign(I18N.ar, LIB_I18N.ar);

const MUSCLES = ["quadriceps", "shoulders", "abdominals", "chest", "hamstrings", "triceps", "biceps", "lats", "middle back", "calves", "lower back", "forearms", "glutes", "traps", "adductors", "abductors", "neck"];
const EQUIPMENT = ["barbell", "dumbbell", "body only", "cable", "machine", "kettlebells", "bands", "medicine ball", "exercise ball", "foam roll", "e-z curl bar", "other"];
const musLabel = (m) => t("mus_" + m);
const eqLabel = (e) => t("eq_" + e);
const lvlLabel = (l) => t("lvl_" + l);

/* ---------- state ---------- */
let libQ = "", libMuscle = "", libEquip = "", libLevel = "";
let libShown = 30;
let libDetail = null;   // index into EXLIB
let libLoading = false;

function resetLibrary() { libQ = ""; libMuscle = ""; libEquip = ""; libLevel = ""; libShown = 30; libDetail = null; }

/* ---------- lazy data load ---------- */
function libEnsureData() {
  if (window.EXLIB || libLoading) return !!window.EXLIB;
  libLoading = true;
  const s = document.createElement("script");
  s.src = "exlib-data.js";
  s.onload = () => { libLoading = false; reRenderSection(); };
  s.onerror = () => { libLoading = false; };
  document.head.appendChild(s);
  return false;
}

/* ---------- filtering ---------- */
function libFiltered() {
  const q = libQ.trim().toLowerCase();
  return window.EXLIB.map((x, i) => ({ x, i })).filter(({ x }) => {
    if (libMuscle && !(x.m || []).includes(libMuscle)) return false;
    if (libEquip && x.eq !== libEquip) return false;
    if (libLevel && x.lv !== libLevel) return false;
    if (q && !(x.n.toLowerCase().includes(q) || (x.m || []).some(m => m.includes(q)) || (x.eq || "").includes(q))) return false;
    return true;
  });
}

/* ---------- rendering ---------- */
function secLibrary() {
  if (!libEnsureData()) return `<h3>📚 ${t("libTitle")}</h3><div class="h-sub">${t("libLoading")}</div><div class="lib-spin">⏳</div>`;
  if (libDetail != null) return libDetailHTML(window.EXLIB[libDetail], libDetail);
  const selOpt = (list, sel, label) => `<option value="">${t("libAll")} — ${label}</option>` +
    list.map(v => `<option value="${esc(v)}"${sel === v ? " selected" : ""}>${esc(label === t("libMuscle") ? musLabel(v) : label === t("libEquip") ? eqLabel(v) : lvlLabel(v))}</option>`).join("");
  return `
  <h3>📚 ${t("libTitle")}</h3>
  <div class="h-sub">${t("libSub")}</div>
  <input class="ob-input lib-search" id="libSearch" type="search" placeholder="${t("libSearch")}" value="${esc(libQ)}">
  <div class="lib-filters">
    <select id="libMuscle">${selOpt(MUSCLES, libMuscle, t("libMuscle"))}</select>
    <select id="libEquip">${selOpt(EQUIPMENT, libEquip, t("libEquip"))}</select>
    <select id="libLevel">${selOpt(["beginner", "intermediate", "expert"], libLevel, t("libLevel"))}</select>
  </div>
  <div id="libResults">${libResultsHTML()}</div>`;
}

function libResultsHTML() {
  const list = libFiltered();
  const shown = list.slice(0, libShown);
  const cards = shown.map(({ x, i }) => `
    <button class="lib-card" data-libopen="${i}">
      <img class="lib-thumb" src="${EXLIB_IMG_BASE}${esc(x.img[0])}" alt="">
      <div class="lib-card-body">
        <div class="lib-name">${esc(x.n)}</div>
        <div class="lib-meta">${(x.m || []).slice(0, 2).map(m => `<span class="chip lib-chip">${musLabel(m)}</span>`).join("")}<span class="chip lib-chip lv-${x.lv}">${lvlLabel(x.lv)}</span></div>
      </div>
    </button>`).join("");
  return `
    <div class="count" style="margin:10px 0 8px">${list.length} ${t("libResults")}</div>
    ${list.length ? `<div class="lib-grid">${cards}</div>` : `<div class="note">${t("libNone")}</div>`}
    ${list.length > libShown ? `<button class="btn ghost block" id="libMore" style="margin-top:12px">${t("libShowMore")} (${list.length - libShown})</button>` : ""}`;
}

function libDetailHTML(x, i) {
  const vid = typeof exVidId === "function" ? exVidId(x.n) : null;
  const ytq = encodeURIComponent(x.n + " exercise form");
  return `
  <button class="linkbtn" id="libBack" style="display:inline-block;margin:0 0 12px">‹ ${t("libBack")}</button>
  <h3>${esc(x.n)}</h3>
  <div class="h-sub">${eqLabel(x.eq)} · ${lvlLabel(x.lv)}</div>
  <div class="lib-imgs">
    ${x.img.slice(0, 2).map(im => `<img src="${EXLIB_IMG_BASE}${esc(im)}" alt="">`).join("")}
  </div>
  <div class="section">
    <h4>🎯 ${t("libPrimary")}</h4>
    <div class="chips">${(x.m || []).map(m => `<span class="chip active">${musLabel(m)}</span>`).join("")}
    ${(x.sm || []).map(m => `<span class="chip">${musLabel(m)}</span>`).join("")}</div>
  </div>
  ${(x.ins && x.ins.length) ? `<div class="section">
    <h4>📋 ${t("libHow")}</h4>
    <ol class="lib-steps">${x.ins.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
  </div>` : ""}
  ${vid
    ? `<button class="btn block" data-video="${vid}" data-vtitle="${esc(x.n)}">▶ ${t("libWatch")}</button>`
    : `<a class="btn ghost block" style="text-align:center" href="https://www.youtube.com/results?search_query=${ytq}" target="_blank" rel="noopener">▶ ${t("libSearchYT")}</a>`}
  <button class="btn ghost block" id="libAddWorkout" data-libadd="${i}" style="margin-top:8px">➕ ${t("libAddWorkout")}</button>`;
}

/* only refresh the results block while typing, so the search box keeps focus */
function libRefreshResults() {
  const el = document.getElementById("libResults");
  if (el) el.innerHTML = libResultsHTML();
}

/* ---------- events (routed from onAuthClick / onAuthChange) ---------- */
function handleLibClick(e) {
  const hit = (s) => e.target.closest(s);
  const open = hit("[data-libopen]");
  if (open) { libDetail = parseInt(open.dataset.libopen, 10); reRenderSection(); return true; }
  if (hit("#libBack")) { libDetail = null; reRenderSection(); return true; }
  const add = hit("[data-libadd]");
  if (add) {
    const u = currentUser();
    if (!(typeof premiumActive === "function" && premiumActive(u))) { toast(t("libNeedPremium")); return true; }
    const x = window.EXLIB[parseInt(add.dataset.libadd, 10)];
    if (x && typeof wSess !== "undefined") { wSess.push({ name: x.n, sets: [] }); toast(t("libAdded")); }
    return true;
  }
  if (hit("#libMore")) { libShown += 30; libRefreshResults(); return true; }
  return false;
}
function handleLibChange(e) {
  if (e.target.id === "libMuscle") { libMuscle = e.target.value; libShown = 30; libRefreshResults(); return true; }
  if (e.target.id === "libEquip") { libEquip = e.target.value; libShown = 30; libRefreshResults(); return true; }
  if (e.target.id === "libLevel") { libLevel = e.target.value; libShown = 30; libRefreshResults(); return true; }
  return false;
}
/* live search while typing */
document.addEventListener("input", (e) => {
  if (e.target && e.target.id === "libSearch") { libQ = e.target.value; libShown = 30; libRefreshResults(); }
});
