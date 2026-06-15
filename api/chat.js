export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY not configured in Vercel'
      });
    }

    const { messages, system } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Missing messages'
      });
    }

    // FAST MODE: use Haiku for both Career and Scholarship
    const selectedModel = 'claude-haiku-4-5-20251001';

    // Keep output enough for 3 paths, but not too slow
    const maxTokens = 850;

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 23000);

    let anthropicRes;

    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: maxTokens,
          system: system || '',
          messages
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    const raw = await anthropicRes.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        error: 'Anthropic returned non-JSON response: ' + raw.substring(0, 200)
      });
    }

    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({
        error: data?.error?.message || `Anthropic error ${anthropicRes.status}`
      });
    }

    const text = data?.content?.[0]?.text;

    if (!text) {
      return res.status(500).json({
        error: 'Empty response from Anthropic'
      });
    }

    return res.status(200).json({
      text
    });

  } catch (error) {
    return res.status(500).json({
      error:
        error.name === 'AbortError'
          ? 'Claude request timed out. Haiku also took too long. Please try again.'
          : error.message || 'Internal server error'
    });
  }
}
