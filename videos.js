/* =============================================================
   GYMORA — exercise form-guide videos
   Every exercise in the plan, workout tracker and rank gets a
   ▶ button that opens a how-to video (YouTube embed) in a
   modal. Video IDs were hand-verified; the modal always offers
   a "Watch on YouTube" fallback link in case an embed is
   blocked or the app is offline.
   Relies on globals: t, I18N, esc.
   ============================================================= */

const VID_I18N = {
  en: { vidGuide: "Form guide", vidWatchYT: "Watch on YouTube" },
  ar: { vidGuide: "شرح الأداء الصحيح", vidWatchYT: "شاهد على يوتيوب" },
};
Object.assign(I18N.en, VID_I18N.en);
Object.assign(I18N.ar, VID_I18N.ar);

/* exercise (english name, lowercase) -> verified YouTube video id */
const EXVIDS = {
  "bench press": "hWbUlkb5Ms4",
  "incline dumbbell press": "8fXfwG4ftaQ",
  "shoulder press": "k6tzKisR3NY",
  "lateral raises": "Kl3LEzQ5Zqs",
  "triceps pushdown": "1FjkhpZsaxc",
  "deadlift": "ZaTM37cfiDs",
  "pull-ups / lat pulldown": "OEXosPwzFdc",
  "barbell row": "qXrTDQG1oUQ",
  "face pulls": "IeOqdw9WI90",
  "biceps curls": "MKWBV29S6c0",
  "squats": "dW3zj79xfrc",
  "romanian deadlift": "5rIqP63yWFg",
  "leg press": "nDh_BlnLCGc",
  "leg curls": "_lgE0gPvbik",
  "calf raises": "eMTy3qylqnE",
  "walking lunges": "mJilHWIBWO8",
  "leg extension": "uM86QE59Tgc",
  "biceps + triceps superset": "c_Dum2NpiH4",
  "plank": "v25dawSzRTM",
  "incline press": "98HWfiRonkE",
  "lat pulldown": "bNmvKpJSWKM",
  "hanging leg raises": "2n4UqRIJyk4",
  "incline treadmill walk": "vdsaHSr1H_E",
  "hiit intervals": "BrliNdYmRVQ",
  "cycling": "rEqRmKAQ5xM",
  "crunches": "ZKw4t23ERuw",
  "hip thrusts": "_i6qpcI1Nw4",
  "bulgarian split squats": "or1frhkjBDc",
  "cable kickbacks": "n-cgsNePyFo",
  "hamstring curls": "_lgE0gPvbik",
  "goblet squats": "lRYBbchqxtI",
  "seated cable row": "qD1WZ5pSuvk",
  "dumbbell shoulder press": "k6tzKisR3NY",
  "chest press machine": "Qu7-ceCvq7w",
  "squat": "dW3zj79xfrc",
  "hip thrust": "_i6qpcI1Nw4",
  "overhead press": "zoN5EH50Dro",
  "barbell curl": "54x2WF1_Suc",
  "dumbbell bench (per hand)": "1V3vpcaxRYQ",
};

function exVidId(en) { return EXVIDS[String(en || "").toLowerCase().trim()] || null; }

/* small round ▶ button placed next to an exercise name */
function exVidBtn(en, label) {
  const id = exVidId(en);
  if (!id) return "";
  return `<button class="vid-btn" data-video="${id}" data-vtitle="${esc(label || en)}" title="${t("vidGuide")}" aria-label="${t("vidGuide")}">▶</button>`;
}

/* ---------- modal player ---------- */
function vidContainer() {
  let el = document.getElementById("vidBack");
  if (!el) {
    el = document.createElement("div");
    el.id = "vidBack";
    el.className = "vid-back";
    document.body.appendChild(el);
    el.addEventListener("click", (e) => { if (e.target.id === "vidBack" || e.target.closest("#vidX")) closeVideo(); });
  }
  return el;
}
function openVideo(id, title) {
  const el = vidContainer();
  el.innerHTML = `
  <div class="vid-modal">
    <button class="auth-x" id="vidX">✕</button>
    <div class="vid-title">🎬 ${esc(title)} — ${t("vidGuide")}</div>
    <div class="vid-frame">
      <iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0"
        title="${esc(title)}" frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>
    </div>
    <a class="btn ghost block" style="margin-top:12px;text-align:center" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">▶ ${t("vidWatchYT")}</a>
  </div>`;
  el.classList.add("open");
}
function closeVideo() {
  const el = document.getElementById("vidBack");
  if (el) { el.classList.remove("open"); el.innerHTML = ""; } // clearing the iframe stops playback
}

/* delegated: any [data-video] element anywhere in the app opens the player */
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-video]");
  if (b) { e.preventDefault(); openVideo(b.dataset.video, b.dataset.vtitle || ""); }
});
document.addEventListener("keydown", (e) => {
  const el = document.getElementById("vidBack");
  if (e.key === "Escape" && el && el.classList.contains("open")) closeVideo();
});
