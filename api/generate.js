// This runs on Vercel's servers, NOT in the browser — your API key stays hidden here.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { prompt, useSearch } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }
  // Output budget: long saga chapters (12-16 cinematic fight panels) need far
  // more room than short generations — a low cap truncates the JSON mid-panel
  // and the frontend sees a parse error. 8000 covers the longest fight scene
  // with headroom, and you only pay for tokens actually generated, so a high
  // cap costs nothing on short responses. Web search shares the same budget.
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
  }
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
