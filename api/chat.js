export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    console.log('Rahnuma API started');

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY');

      return res.status(500).json({
        error: 'ANTHROPIC_API_KEY not configured in Vercel'
      });
    }

    const { messages, system, model } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Missing messages array'
      });
    }

    // Your frontend may still send old names.
    // This safely maps them to current Anthropic model IDs.
    const selectedModel =
      model && model.toLowerCase().includes('sonnet')
        ? 'claude-sonnet-4-6'
        : 'claude-haiku-4-5-20251001';

    const maxTokens = selectedModel.includes('sonnet') ? 700 : 500;

    console.log('Selected model:', selectedModel);
    console.log('Messages count:', messages.length);

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 25000);

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

    console.log('Anthropic status:', anthropicRes.status);

    const rawText = await anthropicRes.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Non-JSON response from Anthropic:', rawText);

      return res.status(500).json({
        error: 'Anthropic returned non-JSON response'
      });
    }

    if (!anthropicRes.ok) {
      console.error('Anthropic error:', data);

      return res.status(anthropicRes.status).json({
        error:
          data?.error?.message ||
          `Anthropic API error ${anthropicRes.status}`
      });
    }

    const text = data?.content?.[0]?.text;

    if (!text) {
      console.error('Empty Claude response:', data);

      return res.status(500).json({
        error: 'Empty response from Claude'
      });
    }

    return res.status(200).json({
      text
    });

  } catch (error) {
    console.error('Rahnuma API error:', error);

    return res.status(500).json({
      error:
        error.name === 'AbortError'
          ? 'Claude request timed out after 25 seconds'
          : error.message || 'Internal server error'
    });
  }
}
