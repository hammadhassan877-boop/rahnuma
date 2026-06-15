export const runtime = 'edge';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const { messages, system, model } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Career coach uses sonnet (quality), scholarship uses haiku (speed)
    const selectedModel = model || 'claude-sonnet-4-5';
    const maxTokens = selectedModel.includes('haiku') ? 600 : 900;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: maxTokens,
        stream: true,
        system: system || '',
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      let errMsg = 'API error ' + anthropicRes.status;
      try { errMsg = JSON.parse(errText)?.error?.message || errMsg; } catch(_) {}
      return new Response(JSON.stringify({ error: errMsg }), {
        status: anthropicRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body.getReader();
        let buf = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                if (
                  parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'text_delta' &&
                  parsed.delta.text
                ) {
                  controller.enqueue(
                    encoder.encode('data: ' + JSON.stringify({ t: parsed.delta.text }) + '\n\n')
                  );
                } else if (parsed.type === 'message_stop') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  controller.close();
                  return;
                }
              } catch (_) {}
            }
          }
        } catch (e) {
          controller.enqueue(
            encoder.encode('data: ' + JSON.stringify({ error: e.message }) + '\n\n')
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
