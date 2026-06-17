export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY not configured in Vercel'
      });
    }

    const { messages, system, model } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing messages' });
    }

    const selectedModel =
      model === 'claude-sonnet-4-5'
        ? 'claude-sonnet-4-5'
        : 'claude-haiku-4-5-20251001';

    const maxTokens =
      selectedModel === 'claude-sonnet-4-5'
        ? 1500
        : 800;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
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

    const data = await anthropicRes.json();

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

    return res.status(200).json({ text });

  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
}
