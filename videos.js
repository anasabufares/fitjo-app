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

/* exercise (english name, lowercase) -> verified YouTube video id.
   3D anatomy-animation style (Muscle & Motion, DEMIC and similar):
   animated model performing the lift with the working muscles
   highlighted. */
const EXVIDS = {
  "bench press": "IqvIZ89KYc4",
  "incline dumbbell press": "9IrOq4WapSQ",
  "shoulder press": "NUuBEo1Hxg8",
  "lateral raises": "WtP691z7Wz8",
  "triceps pushdown": "6C_wQremOp0",
  "deadlift": "o5FvhPAZ_yw",
  "pull-ups / lat pulldown": "YB-Zv6zfQ_A",
  "barbell row": "oM5d6Z4UyL0",
  "face pulls": "-KYuVuQVbgs",
  "biceps curls": "62VfgUaC9-4",
  "squats": "H5VYU6t_w9o",
  "romanian deadlift": "Rg27bvMeTKA",
  "leg press": "QDnCR1eOOPw",
  "leg curls": "w2NxVFKlVj8",
  "calf raises": "lJ_VgvuLlS4",
  "walking lunges": "mi4feuUCU-I",
  "leg extension": "hnLIZ5LK0y8",
  "biceps + triceps superset": "3v4Zc7iujIk",
  "plank": "U7pOJ9M02pg",
  "incline press": "9IrOq4WapSQ",
  "lat pulldown": "lvtheBn9BHA",
  "hanging leg raises": "Wm_3j_9K0vc",
  "incline treadmill walk": "HwXYMPGjlUg",
  "hiit intervals": "HiItpMgzFXQ",
  "cycling": "CTLsy0dzL_8",
  "crunches": "5FENL93dVTw",
  "hip thrusts": "-fwJUbfvrhg",
  "bulgarian split squats": "ibWJx95xo7M",
  "cable kickbacks": "T_8GMhvYRIs",
  "hamstring curls": "4YgxpH2eVec",
  "goblet squats": "qNJdlbTBTLY",
  "seated cable row": "M0sBtlDSii8",
  "dumbbell shoulder press": "NUuBEo1Hxg8",
  "chest press machine": "eG2jAPixOD4",
  "squat": "H5VYU6t_w9o",
  "hip thrust": "-fwJUbfvrhg",
  "overhead press": "NUuBEo1Hxg8",
  "barbell curl": "62VfgUaC9-4",
  "dumbbell bench (per hand)": "Gf65Yy0-wGI",
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
