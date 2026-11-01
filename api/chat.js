module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      service: 'chat',
      configured: !!process.env.ANTHROPIC_API_KEY
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'API key not configured on the server' });
    return;
  }

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    var messages = body.messages;
    var system = body.system;
    var model = body.model;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Missing messages' });
      return;
    }

    var selectedModel = (model === 'claude-sonnet-5-5') ? 'claude-sonnet-5-5' : 'claude-haiku-5-5';
    // Claude 5 models may emit reasoning blocks before the answer, and those
    // count against max_tokens. The old 900/600 budget was being consumed
    // before any visible text was produced, so the roadmap came back empty.
    var maxTokens = (selectedModel === 'claude-sonnet-5-5') ? 2500 : 2000;

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 50000);

    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens,
        system: system || '',
        messages: messages
      })
    });

    clearTimeout(timer);
    var data = await r.json();

    if (!r.ok) {
      var em = (data && data.error && data.error.message) ? data.error.message : ('API error ' + r.status);
      res.status(r.status).json({ error: em });
      return;
    }

    // Take every text block, not just the first content block. Newer models
    // can put a reasoning block at index 0, which has no .text at all.
    var blocks = (data && Array.isArray(data.content)) ? data.content : [];
    var text = '';
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b && b.type === 'text' && typeof b.text === 'string') {
        text += b.text;
      }
    }
    text = text.trim();

    if (!text) {
      var kinds = blocks.map(function (b) { return (b && b.type) ? b.type : '?'; }).join(',') || 'none';
      var why = (data && data.stop_reason === 'max_tokens')
        ? 'The answer was cut off before it finished. Please try again.'
        : 'Empty response from AI';
      res.status(500).json({
        error: why,
        detail: 'stop_reason=' + (data && data.stop_reason ? data.stop_reason : 'unknown') + '; blocks=' + kinds
      });
      return;
    }

    res.status(200).json({ text: text });

  } catch (err) {
    var msg = (err && err.name === 'AbortError')
      ? 'The request took too long. Please try again.'
      : ('Server error: ' + (err && err.message ? err.message : 'unknown'));
    res.status(500).json({ error: msg });
  }
};
