/* =============================================================
   GYMORA — self-hosted exercise videos (in-app, not YouTube)
   -------------------------------------------------------------
   Map an exercise name (lowercase, exactly as it appears in the
   app) to a video file you host yourself. When a name is listed
   here, GYMORA plays it as a real in-app <video> — no YouTube.

   HOW TO ADD YOUR OWN / LICENSED VIDEOS
   1. Get the video files. Either record your own, or buy a
      licensed pack (e.g. exerciseanimatic.com's animation set).
      Do NOT copy videos you don't have the rights to.
   2. Host them. For a few files, drop the .mp4s in a "videos/"
      folder next to index.html. For a big pack (hundreds of
      files, many GB), host them on cheap object storage / CDN
      (Cloudflare R2, Bunny.net, etc.) and set the base URL below.
   3. List them here, e.g.:
        window.GYMORA_VIDEO_BASE = "https://cdn.yoursite.com/exercises/";
        window.EXVIDS_LOCAL = {
          "bench press": "bench-press.mp4",
          "squats": "squats.mp4",
        };
      A value starting with http(s):// is used as-is; anything
      else is resolved against GYMORA_VIDEO_BASE (or the site root
      if the base is empty).

   Local videos take priority over the YouTube fallback in
   videos.js, everywhere a ▶ button appears.
   ============================================================= */

window.GYMORA_VIDEO_BASE = window.GYMORA_VIDEO_BASE || "";
window.EXVIDS_LOCAL = window.EXVIDS_LOCAL || {
  /* Add "exercise name": "file.mp4" lines here once you have the files. */
};
