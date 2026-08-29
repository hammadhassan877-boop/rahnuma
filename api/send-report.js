export const runtime = 'edge';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Report text -> readable HTML. Renders Urdu correctly, unlike the PDF. */
function reportHtml(text, title) {
  const blocks = String(text || '').split(/\n\s*\n/).map(function (b) {
    const t = b.trim();
    if (!t) return '';
    if (t.startsWith('YOU ASKED: ')) {
      return '<p style="margin:22px 0 8px;padding:10px 14px;background:#F3F6F2;border-left:3px solid #D9673B;border-radius:6px;font-size:14px;color:#4C6B67"><strong>You asked:</strong> ' + esc(t.slice(11)) + '</p>';
    }
    const isHead = t.length > 3 && t.length < 70 && t === t.toUpperCase() && /[A-Z]{3}/.test(t);
    if (isHead) {
      return '<h2 style="margin:26px 0 8px;font-size:16px;color:#0B5A54;font-weight:700">' + esc(t) + '</h2>';
    }
    return '<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#14231F">' + esc(t).replace(/\n/g, '<br/>') + '</p>';
  }).join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F6F2;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6F2;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid rgba(11,90,84,0.14)">
  <tr><td style="background:#0B5A54;padding:26px 32px">
    <div style="font-size:20px;font-weight:800;color:#FFFFFF;letter-spacing:-0.01em">CareerRahnuma</div>
    <div style="font-size:13px;color:#B9D6D2;margin-top:5px">${esc(title)}</div>
  </td></tr>
  <tr><td style="padding:30px 32px 8px">
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4C6B67">Here is your report. The same thing is attached as a PDF so you can save it, print it, or share it.</p>
    <div style="height:2px;width:44px;background:#D9673B;margin-bottom:22px"></div>
    ${blocks}
  </td></tr>
  <tr><td style="padding:8px 32px 30px">
    <div style="margin-top:22px;padding:14px 16px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;font-size:13px;line-height:1.55;color:#78350F">
      <strong>Before you apply:</strong> verify every deadline and eligibility requirement on the official website. Details change between cycles.
    </div>
  </td></tr>
  <tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(11,90,84,0.14)">
    <p style="margin:0;font-size:12.5px;line-height:1.6;color:#4C6B67">
      Sent by <a href="https://careerrahnuma.com" style="color:#0B5A54;font-weight:600;text-decoration:none">careerrahnuma.com</a> &mdash; free career and scholarship guidance built for Pakistan.<br/>
      You received this because you asked for your report. We do not send anything else.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

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

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!process.env.RESEND_API_KEY) {
    return json({ error: 'Email is not configured on the server' }, 500);
  }

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid request' }, 400); }

  const type = body.type === 'testimonial' ? 'testimonial' : 'report';

  /* ---------- TESTIMONIAL ---------- */
  if (type === 'testimonial') {
    const { name, university, email, story, photoBase64, photoName } = body;
    if (!name || !story) return json({ error: 'Name and story are required' }, 400);

    const attachments = [];
    if (photoBase64 && photoBase64.length < 3_000_000) {
      attachments.push({
        filename: photoName || 'photo.jpg',
        content: photoBase64,
      });
    }

    const html = `<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;max-width:620px">
      <h2 style="color:#0B5A54;margin:0 0 16px">New testimonial</h2>
      <p style="margin:0 0 6px;font-size:14px"><strong>Name:</strong> ${esc(name)}</p>
      <p style="margin:0 0 6px;font-size:14px"><strong>University:</strong> ${esc(university)}</p>
      <p style="margin:0 0 6px;font-size:14px"><strong>Email:</strong> ${esc(email)}</p>
      <p style="margin:0 0 16px;font-size:14px"><strong>Photo:</strong> ${attachments.length ? 'attached' : 'none'}</p>
      <div style="padding:16px;background:#F3F6F2;border-left:3px solid #D9673B;border-radius:8px;font-size:15px;line-height:1.65;white-space:pre-wrap">${esc(story)}</div>
    </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'CareerRahnuma <admin@careerrahnuma.com>',
        to: ['admin@careerrahnuma.com'],
        reply_to: email || undefined,
        subject: 'New testimonial from ' + name,
        html,
        attachments: attachments.length ? attachments : undefined,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      let m = 'Could not send';
      try { m = JSON.parse(t)?.message || m; } catch {}
      return json({ error: m }, 502);
    }
    return json({ ok: true });
  }

  /* ---------- REPORT ---------- */
  const { email, mode, reportText, pdfBase64 } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: 'Please enter a valid email address' }, 400);
  }
  if (!reportText || reportText.length < 20) {
    return json({ error: 'Report is empty' }, 400);
  }

  const isCareer = mode === 'career';
  const title = isCareer ? 'Your Career Paths' : 'Your Scholarship Roadmap';
  const subject = isCareer
    ? 'Your career paths from CareerRahnuma'
    : 'Your scholarship roadmap from CareerRahnuma';

  const attachments = [];
  if (pdfBase64 && pdfBase64.length > 100 && pdfBase64.length < 8_000_000) {
    attachments.push({
      filename: 'CareerRahnuma-' + (isCareer ? 'Career-Paths' : 'Scholarship-Roadmap') + '.pdf',
      content: pdfBase64,
    });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: 'CareerRahnuma <admin@careerrahnuma.com>',
      to: [email],
      reply_to: 'admin@careerrahnuma.com',
      subject,
      html: reportHtml(reportText, title),
      attachments: attachments.length ? attachments : undefined,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    let m = 'Could not send the email';
    try { m = JSON.parse(t)?.message || m; } catch {}
    return json({ error: m }, 502);
  }

  return json({ ok: true });
}
