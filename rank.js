/* =============================================================
   FitJo — strength rank (Liftoff-style)
   Enter bodyweight + big-3 lifts, get a gaming-style rank per lift
   and overall (Iron -> Grandmaster, divisions III/II/I), a progress
   bar to the next tier and an estimated percentile.
   Standards are simplified bodyweight-ratio thresholds (demo);
   real federation standards can replace BOUNDS later.
   Relies on globals: state, t, I18N, currentUser, updateUser,
   reRenderSection, toast, esc, val, toLb, fmtDate.
   ============================================================= */

const RANK_I18N = {
  en: {
    rankTitle: "Strength rank",
    rankSub: "Enter your lifts — get ranked like a game. Climb from Iron to Grandmaster.",
    bodyweight: "Bodyweight", bench: "Bench press", squat: "Squat", deadlift: "Deadlift",
    liftUnit: "Units", rankSave: "Calculate my rank", rankUpdate: "Update lifts",
    rankErr: "Enter your bodyweight and at least one lift.",
    overallRank: "Overall rank", totalLabel: "Total", ratioLabel: "× bodyweight",
    nextRank: "Next rank", toGo: "to go", maxRank: "Top of the ladder 👑",
    percentile: "Stronger than ~{p}% of lifters (est.)",
    perLift: "Per-lift ranks", lastUpdated: "Last updated",
    rankNote: "Ranks use simplified strength-to-bodyweight standards for this prototype.",
    tier_iron: "Iron", tier_bronze: "Bronze", tier_silver: "Silver", tier_gold: "Gold",
    tier_platinum: "Platinum", tier_diamond: "Diamond", tier_master: "Master", tier_grandmaster: "Grandmaster",
  },
  ar: {
    rankTitle: "تصنيف القوة",
    rankSub: "أدخل أرقامك — واحصل على تصنيف مثل الألعاب. اصعد من الحديدي إلى الغراند ماستر.",
    bodyweight: "وزن الجسم", bench: "بنش برس", squat: "سكوات", deadlift: "رفعة ميتة",
    liftUnit: "الوحدة", rankSave: "احسب تصنيفي", rankUpdate: "تحديث الأرقام",
    rankErr: "أدخل وزن جسمك ورفعة واحدة على الأقل.",
    overallRank: "التصنيف العام", totalLabel: "المجموع", ratioLabel: "× وزن الجسم",
    nextRank: "التصنيف التالي", toGo: "متبقٍ", maxRank: "قمة السلم 👑",
    percentile: "أقوى من ~{p}% من الرياضيين (تقديري)",
    perLift: "تصنيف كل رفعة", lastUpdated: "آخر تحديث",
    rankNote: "التصنيفات تعتمد معايير مبسّطة لنسبة القوة إلى وزن الجسم في هذا النموذج.",
    tier_iron: "حديدي", tier_bronze: "برونزي", tier_silver: "فضي", tier_gold: "ذهبي",
    tier_platinum: "بلاتيني", tier_diamond: "ماسي", tier_master: "ماستر", tier_grandmaster: "غراند ماستر",
  },
};
Object.assign(I18N.en, RANK_I18N.en);
Object.assign(I18N.ar, RANK_I18N.ar);

/* tiers, weakest -> strongest */
const RANK_TIERS = [
  { key: "iron",        color: "#8d96a5" },
  { key: "bronze",      color: "#cd7f32" },
  { key: "silver",      color: "#9fb3c8" },
  { key: "gold",        color: "#f59e0b" },
  { key: "platinum",    color: "#2dd4bf" },
  { key: "diamond",     color: "#60a5fa" },
  { key: "master",      color: "#a78bfa" },
  { key: "grandmaster", color: "#ef4444" },
];
const tierName = (i) => t("tier_" + RANK_TIERS[i].key);

/* bodyweight-ratio thresholds to ENTER tier 1..7 (index 0 = Iron floor).
   7 boundaries -> 8 tiers. Female standards scale by 0.72. */
const RANK_BOUNDS = {
  total:    [1.5, 2.25, 3.0, 3.75, 4.5, 5.25, 6.0],
  bench:    [0.5, 0.80, 1.1, 1.40, 1.7, 2.00, 2.3],
  squat:    [0.75, 1.10, 1.5, 1.90, 2.3, 2.70, 3.1],
  deadlift: [1.0, 1.40, 1.8, 2.20, 2.6, 3.00, 3.4],
};
function rankBounds(kind, gender) {
  const f = gender === "f" ? 0.72 : 1;
  return RANK_BOUNDS[kind].map(b => b * f);
}
/* ratio -> { tier 0-7, div 3|2|1, progress 0-1 within tier, next ratio } */
function rankFor(ratio, kind, gender) {
  const bounds = rankBounds(kind, gender);
  let tier = 0;
  while (tier < bounds.length && ratio >= bounds[tier]) tier++;
  const lo = tier === 0 ? 0 : bounds[tier - 1];
  const hi = tier < bounds.length ? bounds[tier] : null;
  const progress = hi == null ? 1 : Math.max(0, Math.min(1, (ratio - lo) / (hi - lo)));
  const div = hi == null ? 1 : progress < 1 / 3 ? 3 : progress < 2 / 3 ? 2 : 1;
  return { tier, div, progress, next: hi };
}
const divRoman = (d) => ({ 1: "I", 2: "II", 3: "III" })[d];

/* ---------- section ---------- */
function rankChip(label, kg, ratio, r) {
  const tcol = RANK_TIERS[r.tier].color;
  return `<div class="rank-lift">
    <div class="rl-name">${label}</div>
    <div class="rl-badge" style="background:${tcol}">${tierName(r.tier)} ${divRoman(r.div)}</div>
    <div class="rl-nums">${kg} kg · ${toLb(kg)} lb<br><small>${ratio.toFixed(2)} ${t("ratioLabel")}</small></div>
  </div>`;
}
function secRank(u) {
  const L = u.lifts || null;
  const latestW = (u.weights && u.weights.length) ? u.weights[u.weights.length - 1].kg : (u.intake && u.intake.weight) || "";
  const form = `
  <div class="section">
    <div class="form-two">
      <div class="form-row"><label>${t("bodyweight")} (kg)</label><input id="rkBw" type="number" step="0.5" min="30" max="300" value="${L ? L.bw : latestW}" placeholder="80"></div>
      <div class="form-row"><label>${t("liftUnit")}</label>
        <select id="rkUnit"><option value="kg">kg</option><option value="lb">lb</option></select></div>
    </div>
    <div class="form-two">
      <div class="form-row"><label>🏋️ ${t("bench")}</label><input id="rkBench" type="number" step="0.5" min="0" value="${L ? L.bench : ""}" placeholder="80"></div>
      <div class="form-row"><label>🦵 ${t("squat")}</label><input id="rkSquat" type="number" step="0.5" min="0" value="${L ? L.squat : ""}" placeholder="110"></div>
    </div>
    <div class="form-row"><label>⚡ ${t("deadlift")}</label><input id="rkDead" type="number" step="0.5" min="0" value="${L ? L.deadlift : ""}" placeholder="140"></div>
    <button class="btn block" id="rankSave">${L ? t("rankUpdate") : t("rankSave")}</button>
  </div>`;

  if (!L) return `<h3>🏆 ${t("rankTitle")}</h3><div class="h-sub">${t("rankSub")}</div>${form}<div class="note">${t("rankNote")}</div>`;

  const total = Math.round((L.bench + L.squat + L.deadlift) * 10) / 10;
  const ratio = total / L.bw;
  const overall = rankFor(ratio, "total", u.gender);
  const tcol = RANK_TIERS[overall.tier].color;
  const pct = Math.min(99.9, Math.round(Math.pow(ratio / 6.5, 1.5) * 99 * 10) / 10);
  const nextBar = overall.next == null
    ? `<div class="note">${t("maxRank")}</div>`
    : `<div class="mb-top"><span>${t("nextRank")}: ${tierName(overall.tier + 1)}</span>
         <span>${Math.max(0, Math.round((overall.next * L.bw - total) * 10) / 10)} kg ${t("toGo")}</span></div>
       <div class="mb-track"><span style="width:${Math.round(overall.progress * 100)}%;background:${tcol}"></span></div>`;
  return `
  <h3>🏆 ${t("rankTitle")}</h3>
  <div class="h-sub">${t("rankSub")}</div>
  <div class="rank-card" style="--tier:${tcol}">
    <div class="rank-medal">🏆</div>
    <div class="rank-tier">${tierName(overall.tier)} ${divRoman(overall.div)}</div>
    <div class="rank-total">${t("totalLabel")}: <b>${total} kg</b> · ${toLb(total)} lb <small>(${ratio.toFixed(2)} ${t("ratioLabel")})</small></div>
    <div class="rank-next">${nextBar}</div>
    <div class="rank-pct">${t("percentile").replace("{p}", pct)}</div>
  </div>
  <div class="section">
    <h4>${t("perLift")}</h4>
    <div class="rank-lifts">
      ${rankChip(t("bench"), L.bench, L.bench / L.bw, rankFor(L.bench / L.bw, "bench", u.gender))}
      ${rankChip(t("squat"), L.squat, L.squat / L.bw, rankFor(L.squat / L.bw, "squat", u.gender))}
      ${rankChip(t("deadlift"), L.deadlift, L.deadlift / L.bw, rankFor(L.deadlift / L.bw, "deadlift", u.gender))}
    </div>
    <div class="note">${t("lastUpdated")}: ${fmtDate(L.date)}</div>
  </div>
  ${form}
  <div class="note">${t("rankNote")}</div>`;
}

/* ---------- actions ---------- */
function rankSave() {
  const toKg = (v) => (val("rkUnit") === "lb" ? v / 2.20462 : v);
  const bw = parseFloat(val("rkBw"));
  const bench = Math.round(toKg(parseFloat(val("rkBench")) || 0) * 10) / 10;
  const squat = Math.round(toKg(parseFloat(val("rkSquat")) || 0) * 10) / 10;
  const deadlift = Math.round(toKg(parseFloat(val("rkDead")) || 0) * 10) / 10;
  if (!(bw >= 30 && bw <= 300) || (bench + squat + deadlift) <= 0) return toast(t("rankErr"));
  updateUser({ lifts: { bw: Math.round(bw * 10) / 10, bench, squat, deadlift, date: Date.now() } });
  reRenderSection();
  toast("🏆");
}
function handleRankClick(e) {
  if (e.target.closest("#rankSave")) { rankSave(); return true; }
  return false;
}
