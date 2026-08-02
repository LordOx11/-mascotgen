// 🛑 KILL SWITCH — set to false to stop all video spend instantly.
// Every start request is refused while this is off; nothing reaches fal, so
// nothing can be charged. Status checks on EXISTING jobs still work, so any
// clip already paid for can still be collected.
const VIDEO_ENABLED = false;

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
