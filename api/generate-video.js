// 🎬 Video feature (Elite) — animates the mascot's art into a short clip via
// fal.ai's Kling 2.1 Standard image-to-video (~$0.25 per 5s clip, same FAL_KEY).
// Video generation takes minutes, so this uses fal's QUEUE protocol:
//   action:"start"  -> submits the job, returns a requestId immediately
//   action:"status" -> polls; returns { status } or { videoUrl } when done
// Limit: 3 videos per mascot (tracked in art_usage under "video:"+mascotId).
// Env vars: FAL_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, DEV_EMAILS
const QUEUE_BASE = "https://queue.fal.run/fal-ai/kling-video/v2.1/standard/image-to-video";
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

      const submit = await fetch(QUEUE_BASE, {
        method: "POST",
        headers: falHeaders,
        body: JSON.stringify({
          image_url: imageUrl,
          prompt:
            (motionPrompt ||
              "The character comes to life with subtle natural motion — breathing, blinking, hair and clothing moving in a light breeze, confident idle animation") +
            ". Keep the character's exact appearance, colors and art style. Smooth, high-quality animation.",
          duration: "5",
        }),
      });
      const data = await submit.json();
      if (!submit.ok || !data.request_id) {
        return res.status(502).json({ error: data.detail || data.error || "Video submission failed" });
      }

      // Count the video at submission (a submitted job costs money either way).
      if (!isDevEmail(email)) {
        const used = await getVideoCount(email, mascotId);
        await bumpVideoCount(email, mascotId, used + 1);
      }

      return res.status(200).json({ requestId: data.request_id });
    }

    if (action === "status") {
      const { requestId } = req.body;
      if (!requestId) return res.status(400).json({ error: "Need requestId" });

      const statusRes = await fetch(`${QUEUE_BASE}/requests/${requestId}/status`, { headers: falHeaders });
      const status = await statusRes.json();

      if (status.status === "COMPLETED") {
        const resultRes = await fetch(`${QUEUE_BASE}/requests/${requestId}`, { headers: falHeaders });
        const result = await resultRes.json();
        const videoUrl = result?.video?.url || result?.output?.video?.url || null;
        if (!videoUrl) return res.status(502).json({ error: "Video completed but no URL returned" });
        return res.status(200).json({ status: "done", videoUrl });
      }
      if (status.status === "FAILED" || status.status === "ERROR") {
        return res.status(200).json({ status: "failed" });
      }
      return res.status(200).json({ status: "processing", queuePosition: status.queue_position });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
