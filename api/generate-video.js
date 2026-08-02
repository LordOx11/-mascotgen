// 🛑 KILL SWITCH — set to false to stop all video spend instantly.
// Every start request is refused while this is off; nothing reaches fal, so
// nothing can be charged. Status checks on EXISTING jobs still work, so any
// clip already paid for can still be collected.
const VIDEO_ENABLED = true;

// 🎬 Video feature (Elite) — animates the mascot's art into a short clip.
// TWO MODELS, one switch:
//   "fast"    → LTX-Video: generates in SECONDS. Lighter quality, instant joy.
//   "quality" → Kling 2.1 Standard: cinema-grade, but takes minutes (~$0.25/5s).
// Flip VIDEO_MODE below and redeploy to change — nothing else needs touching.
// Both use fal's QUEUE protocol:
//   action:"start"  -> submits the job, returns a requestId immediately
//   action:"status" -> polls; returns { status } or { videoUrl } when done
// Limit: 3 videos per mascot (tracked in art_usage under "video:"+mascotId).
// Env vars: FAL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS

const MODELS = {
  fast: "fal-ai/ltx-video/image-to-video",
  quality: "fal-ai/kling-video/v2.1/standard/image-to-video",
};
const VIDEO_MODE = "quality"; // ← "fast" (LTX) got stuck in testing; Kling is slow but reliable
const QUEUE_BASE = `https://queue.fal.run/${MODELS[VIDEO_MODE]}`;
// fal quirk: you SUBMIT to the full model path, but status/result live under
// the model's ROOT namespace (first two path segments). Polling the full path
// returns a non-JSON 404 — which looked exactly like a "stale job".
const STATUS_BASE = `https://queue.fal.run/${MODELS[VIDEO_MODE].split("/").slice(0, 2).join("/")}`;
const VIDEO_LIMIT = 3; // per mascot

// 🎞️ SAGA MOVIES — one clip per story panel, stitched into a single MP4.
//   action:"movie_start"  -> submits ONE Kling job PER PANEL (parallel), returns clip requestIds
//   action:"status"       -> (reused) polls each clip like any other video job
//   action:"movie_stitch" -> when every clip is done, merges them into one MP4 via fal's ffmpeg
//   action:"movie_status" -> polls the merge job, returns the final movie URL
// Cost model: each 5s Kling panel clip ≈ $0.25 of fal credits, the merge is pennies.
// Charged to the user as 1 daily generation credit PER PANEL, plus a hard cap of
// MOVIE_LIMIT movies per mascot (tracked in art_usage under "movie:"+mascotId).
const MOVIE_LIMIT = 1; // movies per mascot — raise when pricing supports it
const MOVIE_MIN_PANELS = 2;
const MOVIE_MAX_PANELS = 8;
const MOVIE_CLIP_DURATION = "5"; // seconds per panel clip (Kling); keeps cost ~$0.25/panel
const ELITE_DAILY_GEN_LIMIT = 20; // keep in sync with PLAN_LIMITS.elite in api/generate.js
const MERGE_MODEL = "fal-ai/ffmpeg-api/merge-videos";
const MERGE_QUEUE = `https://queue.fal.run/${MERGE_MODEL}`;
// Same fal quirk as above: submit to the full model path, poll the ROOT namespace.
const MERGE_STATUS_BASE = `https://queue.fal.run/${MERGE_MODEL.split("/").slice(0, 2).join("/")}`;

function isDevEmail(email) {
  const list = (process.env.DEV_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes((email || "").toLowerCase());
}

const sbHeaders = {
  "Content-Type": "application/json",
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
};

async function getSubscriber(email) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}&select=plan,status`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function getVideoCount(email, mascotId) {
  const key = `video:${mascotId}`;
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/art_usage?email=eq.${encodeURIComponent(email.toLowerCase())}&mascot_id=eq.${encodeURIComponent(key)}&select=regens`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].regens : 0;
}

// Movie usage: same art_usage table, "movie:" prefix — no schema change needed.
async function getMovieCount(email, mascotId) {
  const key = `movie:${mascotId}`;
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/art_usage?email=eq.${encodeURIComponent(email.toLowerCase())}&mascot_id=eq.${encodeURIComponent(key)}&select=regens`,
    { headers: sbHeaders }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows[0] ? rows[0].regens : 0;
}

async function bumpMovieCount(email, mascotId, next) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/art_usage`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      email: email.toLowerCase(),
      mascot_id: `movie:${mascotId}`,
      regens: next,
      regen_limit: MOVIE_LIMIT,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Failed to record movie usage: ${await res.text()}`);
}

// Daily generation credits (1 per panel). Mirrors api/generate.js's gen_usage
// tracking for Elite's daily bucket. Fails OPEN on database errors so a
// Supabase hiccup never bricks the studio.
async function checkAndChargeCredits(email, weight) {
  const key = email.toLowerCase();
  const day = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/gen_usage?email=eq.${encodeURIComponent(key)}&day=eq.${day}&select=day,count`,
      { headers: sbHeaders }
    );
    const rows = await res.json();
    const todayRow = Array.isArray(rows) ? rows.find((r) => r.day === day) : null;
    const usedToday = todayRow ? todayRow.count || 0 : 0;
    if (usedToday + weight > ELITE_DAILY_GEN_LIMIT) {
      return { ok: false, used: usedToday, limit: ELITE_DAILY_GEN_LIMIT };
    }
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/gen_usage`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ email: key, day, count: usedToday + weight }),
    });
    return { ok: true, used: usedToday + weight, limit: ELITE_DAILY_GEN_LIMIT };
  } catch (e) {
    return { ok: true, used: 0, limit: ELITE_DAILY_GEN_LIMIT };
  }
}

// Downloads the mascot's art and returns it as a data URI — same trick as the
// single-clip flow: fal never has to touch the Irys CDN, and every clip starts
// from the EXACT minted bytes. Throws with a plain message on failure.
async function imageToDataUri(imageUrl) {
  const imgRes = await fetch(imageUrl, { cache: "no-store" });
  if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
  const contentType = imgRes.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await imgRes.arrayBuffer());
  if (buf.length > 9 * 1024 * 1024) throw new Error("image too large for inline submit");
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

async function bumpVideoCount(email, mascotId, next) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/art_usage`, {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      email: email.toLowerCase(),
      mascot_id: `video:${mascotId}`,
      regens: next,
      regen_limit: VIDEO_LIMIT,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`Failed to record video usage: ${await res.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action, email } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email required." });

  const falHeaders = {
    Authorization: `Key ${process.env.FAL_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    if (action === "start") {
    if (!VIDEO_ENABLED) {
      return res.status(503).json({
        error: "🛠 Video generation is temporarily disabled while we move to a more reliable provider. Everything else works normally — your mascots, stories, battles, and minting are unaffected.",
      });
    }
      const { mascotId, imageUrl, motionPrompt } = req.body;
      if (!mascotId || !imageUrl) return res.status(400).json({ error: "Need mascotId and imageUrl" });

      const devBypass = isDevEmail(email);
      if (!devBypass) {
        const sub = await getSubscriber(email);
        // Elite-only feature (legacy platinum_pass counts as the old all-access).
        const elitePlans = ["elite", "platinum_pass"];
        if (!sub || sub.status !== "active" || !elitePlans.includes(sub.plan)) {
          return res.status(402).json({ error: "🎬 Video is an Elite feature — see Pricing.", needsPlan: true });
        }
        const used = await getVideoCount(email, mascotId);
        if (used >= VIDEO_LIMIT) {
          return res.status(402).json({ error: `This mascot has used all ${VIDEO_LIMIT} video generations.` });
        }
      }

      // ---- Fetch the image OURSELVES and hand fal the bytes -----------------
      // The minted art lives on gateway.irys.xyz, whose CDN can refuse
      // connections (we've seen it). If fal's fetch hits that, the job hangs
      // forever. So the server downloads the image here and submits it as a
      // data URI — fal never has to touch Irys, and the video is guaranteed to
      // start from the EXACT minted bytes.
      let submitImageUrl = imageUrl;
      try {
        const imgRes = await fetch(imageUrl, { cache: "no-store" });
        if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
        const contentType = imgRes.headers.get("content-type") || "image/png";
        const buf = Buffer.from(await imgRes.arrayBuffer());
        if (buf.length > 9 * 1024 * 1024) throw new Error("image too large for inline submit");
        submitImageUrl = `data:${contentType};base64,${buf.toString("base64")}`;
      } catch (e) {
        // Couldn't fetch it server-side either — tell the user plainly instead
        // of submitting a job that will hang.
        return res.status(502).json({
          error: `Couldn't download this character's art (${e.message}). The storage gateway may be having a bad day — try again in a few minutes.`,
        });
      }

      const fullPrompt =
        (motionPrompt ||
          "The character comes to life with subtle natural motion — breathing, blinking, hair and clothing moving in a light breeze, confident idle animation") +
        ". Keep the character's exact appearance, colors and art style. Smooth, high-quality animation.";

      // Kling accepts a duration param; LTX manages its own clip length.
      const submitBody =
        VIDEO_MODE === "quality"
          ? { image_url: submitImageUrl, prompt: fullPrompt, duration: "10" }
          : { image_url: submitImageUrl, prompt: fullPrompt };

      const submit = await fetch(QUEUE_BASE, {
        method: "POST",
        headers: falHeaders,
        body: JSON.stringify(submitBody),
      });
      const data = await submit.json();
      if (!submit.ok || !data.request_id) {
        return res.status(502).json({ error: data.detail || data.error || "Video submission failed" });
      }

      // Count the video at submission (a submitted job costs money either way).
      if (!devBypass) {
        const used = await getVideoCount(email, mascotId);
        await bumpVideoCount(email, mascotId, used + 1);
      }

      return res.status(200).json({ requestId: data.request_id });
    }

    // ---- 🎞️ MOVIE: submit one clip per panel --------------------------------
    if (action === "movie_start") {
      if (!VIDEO_ENABLED) {
        return res.status(503).json({
          error: "🛠 Video generation is temporarily disabled. Everything else works normally.",
        });
      }
      const { mascotId, imageUrl, panels, characterName } = req.body;
      if (!mascotId || !imageUrl) return res.status(400).json({ error: "Need mascotId and imageUrl" });
      const cleanPanels = (Array.isArray(panels) ? panels : [])
        .map((p) => String(p || "").trim())
        .filter(Boolean)
        .slice(0, MOVIE_MAX_PANELS);
      if (cleanPanels.length < MOVIE_MIN_PANELS) {
        return res.status(400).json({ error: `A movie needs at least ${MOVIE_MIN_PANELS} story panels.` });
      }

      const devBypass = isDevEmail(email);
      if (!devBypass) {
        const sub = await getSubscriber(email);
        const elitePlans = ["elite", "platinum_pass"];
        if (!sub || sub.status !== "active" || !elitePlans.includes(sub.plan)) {
          return res.status(402).json({ error: "🎞️ Saga Movies are an Elite feature — see Pricing.", needsPlan: true });
        }
        const movies = await getMovieCount(email, mascotId);
        if (movies >= MOVIE_LIMIT) {
          return res.status(402).json({
            error: `This mascot has already used its ${MOVIE_LIMIT === 1 ? "movie" : `${MOVIE_LIMIT} movies`}. More per mascot is coming — for now, make a movie for another mascot.`,
          });
        }
      }

      let submitImageUrl;
      try {
        submitImageUrl = await imageToDataUri(imageUrl);
      } catch (e) {
        return res.status(502).json({
          error: `Couldn't download this character's art (${e.message}). The storage gateway may be having a bad day — try again in a few minutes.`,
        });
      }

      // 1 daily generation credit per panel — charged only AFTER the art
      // downloaded fine, so a storage hiccup never eats anyone's allowance.
      if (!devBypass) {
        const credits = await checkAndChargeCredits(email, cleanPanels.length);
        if (!credits.ok) {
          return res.status(402).json({
            error: `A ${cleanPanels.length}-panel movie costs ${cleanPanels.length} of your daily generations and you've used ${credits.used}/${credits.limit} today. Your allowance resets at midnight UTC.`,
          });
        }
      }

      // One Kling job per panel, submitted in PARALLEL so this request stays
      // fast. Each panel's text becomes that clip's motion prompt, so the
      // movie follows the chapter beat by beat.
      const name = String(characterName || "The character").slice(0, 80);
      const submits = await Promise.all(
        cleanPanels.map(async (panelText, i) => {
          const fullPrompt =
            `${name} — cinematic animated scene ${i + 1} of ${cleanPanels.length}: ${panelText.slice(0, 280)}. ` +
            "Keep the character's exact appearance, colors and art style. Smooth, high-quality animation.";
          try {
            const submit = await fetch(QUEUE_BASE, {
              method: "POST",
              headers: falHeaders,
              body: JSON.stringify({
                image_url: submitImageUrl,
                prompt: fullPrompt,
                ...(VIDEO_MODE === "quality" ? { duration: MOVIE_CLIP_DURATION } : {}),
              }),
            });
            const data = await submit.json();
            if (!submit.ok || !data.request_id) {
              return { panelIndex: i, error: String(data.detail || data.error || `submit ${submit.status}`).slice(0, 200) };
            }
            return { panelIndex: i, requestId: data.request_id };
          } catch (e) {
            return { panelIndex: i, error: e.message };
          }
        })
      );

      const goodClips = submits.filter((s) => s.requestId);
      // If fal refused nearly everything, don't charge the movie slot — bail.
      if (goodClips.length < MOVIE_MIN_PANELS) {
        const firstErr = submits.find((s) => s.error);
        return res.status(502).json({
          error: `Movie submission failed (${firstErr ? firstErr.error : "no clips accepted"}). Check the fal.ai dashboard balance and try again — you were NOT charged a movie slot.`,
        });
      }

      // Count the movie at submission — the clips cost money either way.
      if (!devBypass) {
        const movies = await getMovieCount(email, mascotId);
        await bumpMovieCount(email, mascotId, movies + 1);
      }

      return res.status(200).json({
        clips: submits, // [{panelIndex, requestId} | {panelIndex, error}]
        submitted: goodClips.length,
        failed: submits.length - goodClips.length,
      });
    }

    // ---- 🎞️ MOVIE: merge finished clips into one MP4 ------------------------
    if (action === "movie_stitch") {
      const { videoUrls } = req.body;
      // Only stitch clips that live on fal's own storage — this endpoint runs
      // on OUR fal key, so it must never become a free ffmpeg service for
      // arbitrary URLs.
      const isFalUrl = (u) => {
        try {
          const h = new URL(u).hostname;
          return h === "fal.media" || h.endsWith(".fal.media") || h.endsWith(".fal.run") || h.endsWith(".fal.ai");
        } catch (e) { return false; }
      };
      const urls = (Array.isArray(videoUrls) ? videoUrls : [])
        .map((u) => String(u || ""))
        .filter((u) => u.startsWith("https://") && isFalUrl(u));
      if (urls.length < MOVIE_MIN_PANELS) {
        return res.status(400).json({ error: `Need at least ${MOVIE_MIN_PANELS} finished clips to stitch.` });
      }
      const submit = await fetch(MERGE_QUEUE, {
        method: "POST",
        headers: falHeaders,
        body: JSON.stringify({ video_urls: urls.slice(0, MOVIE_MAX_PANELS) }),
      });
      const data = await submit.json();
      if (!submit.ok || !data.request_id) {
        return res.status(502).json({ error: data.detail || data.error || "Stitch submission failed" });
      }
      return res.status(200).json({ stitchRequestId: data.request_id });
    }

    // ---- 🎞️ MOVIE: poll the merge job ---------------------------------------
    if (action === "movie_status") {
      const { requestId } = req.body;
      if (!requestId) return res.status(400).json({ error: "Need requestId" });
      const statusRes = await fetch(`${MERGE_STATUS_BASE}/requests/${requestId}/status?logs=1`, { headers: falHeaders });
      const rawText = await statusRes.text();
      let status;
      try {
        status = JSON.parse(rawText);
      } catch (e) {
        return res.status(200).json({
          status: "failed",
          stale: true,
          error: "That stitch job no longer exists. Hit MAKE A SAGA MOVIE's check button again to restitch.",
        });
      }
      if (!statusRes.ok || status.status === "FAILED" || status.status === "CANCELLED" || status.error || status.detail) {
        const reason = status.error || status.detail || `fal returned ${statusRes.status}`;
        return res.status(200).json({
          status: "failed",
          error: `Stitching failed: ${typeof reason === "string" ? reason : JSON.stringify(reason)}`,
        });
      }
      if (status.status === "COMPLETED") {
        const resultRes = await fetch(`${MERGE_STATUS_BASE}/requests/${requestId}`, { headers: falHeaders });
        const result = await resultRes.json();
        const movieUrl = result?.video?.url || result?.output?.video?.url || null;
        if (!movieUrl) return res.status(502).json({ error: "Stitch completed but no URL returned" });
        return res.status(200).json({ status: "done", movieUrl });
      }
      return res.status(200).json({ status: "processing", queuePosition: status.queue_position });
    }

    if (action === "status") {
      const { requestId } = req.body;
      if (!requestId) return res.status(400).json({ error: "Need requestId" });

      const statusRes = await fetch(`${STATUS_BASE}/requests/${requestId}/status?logs=1`, { headers: falHeaders });
      // fal can answer non-JSON for unknown/expired/cross-model request ids
      // (e.g. a job submitted under a previous VIDEO_MODE). Never let that
      // crash the endpoint — report it as a dead job instead.
      const rawText = await statusRes.text();
      let status;
      try {
        status = JSON.parse(rawText);
      } catch (e) {
        return res.status(200).json({
          status: "failed",
          stale: true,
          error: "That video job no longer exists (it was started under an older setup). Hit BRING TO LIFE again to start a fresh one.",
        });
      }

      // Surface hard failures instead of hiding them behind "processing".
      if (!statusRes.ok || status.status === "FAILED" || status.status === "CANCELLED" || status.error || status.detail) {
        const reason = status.error || status.detail || `fal returned ${statusRes.status}`;
        return res.status(200).json({
          status: "failed",
          error: `Video job failed: ${typeof reason === "string" ? reason : JSON.stringify(reason)}. If this keeps happening, check the fal.ai dashboard balance and request log.`,
        });
      }

      if (status.status === "COMPLETED") {
        const resultRes = await fetch(`${STATUS_BASE}/requests/${requestId}`, { headers: falHeaders });
        const result = await resultRes.json();
        const videoUrl = result?.video?.url || result?.output?.video?.url || null;
        if (!videoUrl) return res.status(502).json({ error: "Video completed but no URL returned" });
        return res.status(200).json({ status: "done", videoUrl });
      }
      if (status.status === "FAILED" || status.status === "ERROR") {
        // Pull the real reason out of fal's payload — logs often name the
        // cause outright (moderation, unreachable image, bad dimensions).
        const logLines = Array.isArray(status.logs)
          ? status.logs.map((l) => (typeof l === "string" ? l : l.message)).filter(Boolean).slice(-3).join(" | ")
          : "";
        let detail = status.error || status.detail || logLines || "";
        if (typeof detail !== "string") detail = JSON.stringify(detail);
        // Ask fal for the result body too — failures often carry the reason there.
        if (!detail) {
          try {
            const r = await fetch(`${STATUS_BASE}/requests/${requestId}`, { headers: falHeaders });
            const t = await r.text();
            detail = t.slice(0, 300);
          } catch (e) {}
        }
        return res.status(200).json({
          status: "failed",
          error: detail
            ? `fal rejected this job: ${detail}`
            : "fal rejected this job without a reason. Common causes: the source image wasn't reachable, or it tripped content moderation. Try a different mascot to narrow it down.",
        });
      }
      return res.status(200).json({ status: "processing", queuePosition: status.queue_position });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
