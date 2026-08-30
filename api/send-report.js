function esc(s) {
  return String(s == null ? '' : s)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;');
}

function reportHtml(text, title) {
  var parts = String(text || '').split(/\n\s*\n/);
  var blocks = '';
  for (var i = 0; i < parts.length; i++) {
    var t = parts[i].trim();
    if (!t) continue;
    if (t.indexOf('YOU ASKED: ') === 0) {
      blocks += '<p style="margin:22px 0 8px;padding:10px 14px;background:#F3F6F2;border-left:3px solid #D9673B;border-radius:6px;font-size:14px;color:#4C6B67"><strong>You asked:</strong> ' + esc(t.slice(11)) + '</p>';
      continue;
    }
    var isHead = t.length > 3 && t.length < 70 && t === t.toUpperCase() && /[A-Z]{3}/.test(t);
    if (isHead) {
      blocks += '<h2 style="margin:26px 0 8px;font-size:16px;color:#0B5A54;font-weight:700">' + esc(t) + '</h2>';
    } else {
      blocks += '<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#14231F">' + esc(t).split('\n').join('<br/>') + '</p>';
    }
  }

  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F6F2;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6F2;padding:24px 12px"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid rgba(11,90,84,0.14)">'
    + '<tr><td style="background:#0B5A54;padding:26px 32px">'
    + '<div style="font-size:20px;font-weight:800;color:#FFFFFF">CareerRahnuma</div>'
    + '<div style="font-size:13px;color:#B9D6D2;margin-top:5px">' + esc(title) + '</div>'
    + '</td></tr>'
    + '<tr><td style="padding:30px 32px 8px">'
    + '<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4C6B67">Here is your report. The same thing is attached as a PDF so you can save it, print it, or share it.</p>'
    + '<div style="height:2px;width:44px;background:#D9673B;margin-bottom:22px"></div>'
    + blocks
    + '</td></tr>'
    + '<tr><td style="padding:8px 32px 30px">'
    + '<div style="margin-top:22px;padding:14px 16px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;font-size:13px;line-height:1.55;color:#78350F">'
    + '<strong>Before you apply:</strong> verify every deadline and eligibility requirement on the official website. Details change between cycles.'
    + '</div></td></tr>'
    + '<tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(11,90,84,0.14)">'
    + '<p style="margin:0;font-size:12.5px;line-height:1.6;color:#4C6B67">Sent by <a href="https://careerrahnuma.com" style="color:#0B5A54;font-weight:600;text-decoration:none">careerrahnuma.com</a> \u00B7 Career and scholarship guidance built for Pakistan.<br/>You received this because you asked for your report.</p>'
    + '</td></tr></table></td></tr></table></body></html>';
}

async function sendMail(payload) {
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, 12000);
  try {
    payload.headers = payload.headers || {};
    payload.headers['X-Entity-Ref-ID'] = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 9);

    var r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
      },
      body: JSON.stringify(payload)
    });
    clearTimeout(timer);
    var body = await r.text();
    return { ok: r.ok, status: r.status, body: body };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, status: 0, body: String(e && e.message ? e.message : e) };
  }
}


function firstName(n) {
  var parts = String(n || '').trim().split(/\s+/);
  return parts[0] || 'there';
}

function thankYouHtml(name, hasCard) {
  var fn = esc(firstName(name));
  var cardBit = hasCard
    ? '<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#14231F">We made you something small. It is attached, a card with your words on it. If you would like to share it so more people can know about it, the caption below is yours to use or rewrite however you want.</p>'
    : '';
  var captionBox = hasCard
    ? '<div style="margin:22px 0 6px;padding:18px 20px;background:#F3F6F2;border-left:3px solid #D9673B;border-radius:10px">'
      + '<p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#D9673B">A caption, if you want one</p>'
      + '<p style="margin:0;font-size:14.5px;line-height:1.7;color:#14231F;white-space:pre-line">'
      + 'A while ago I was not sure what my next step looked like.\n\n'
      + 'I shared that story with CareerRahnuma, a career and scholarship guide built for Pakistani graduates, because when I was figuring it out, hearing from someone who had been there would have helped.\n\n'
      + 'If you are somewhere in the middle of it right now, you are not the only one.'
      + '</p>'
      + '<p style="margin:14px 0 0;font-size:12.5px;color:#4C6B67;line-height:1.55">Change it, shorten it, make it sound like you. It will land better in your own words.</p>'
      + '</div>'
    : '';

  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F3F6F2;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6F2;padding:24px 12px"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid rgba(11,90,84,0.14)">'
    + '<tr><td style="background:#0B5A54;padding:26px 32px">'
    + '<div style="font-size:20px;font-weight:800;color:#FFFFFF">CareerRahnuma</div>'
    + '<div style="font-size:13px;color:#B9D6D2;margin-top:5px">Shukriya, ' + fn + '</div>'
    + '</td></tr>'
    + '<tr><td style="padding:30px 32px 26px">'
    + '<p style="margin:0 0 16px;font-size:15.5px;line-height:1.65;color:#14231F">' + fn + ', thank you sooo much for writing that.</p>'
    + '<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#14231F">Most people who use Rahnuma are somewhere in the middle of a hard decision, usually on their own, often late at night. Reading that someone else stood where they are standing and found a way through does more than anything we could write ourselves.</p>'
    + cardBit
    + captionBox
    + '<p style="margin:22px 0 0;font-size:15px;line-height:1.65;color:#14231F">And if there is ever anything we can help with, an application, a decision, or just thinking something through, reply to this email. It comes straight to us.</p>'
    + '<p style="margin:18px 0 0;font-size:15px;line-height:1.65;color:#14231F">Warmly,<br/><strong>Team CareerRahnuma</strong></p>'
    + '</td></tr>'
    + '<tr><td style="padding:18px 32px 26px;border-top:1px solid rgba(11,90,84,0.14)">'
    + '<p style="margin:0;font-size:12.5px;line-height:1.6;color:#4C6B67">'
    + '<a href="https://careerrahnuma.com" style="color:#0B5A54;font-weight:600;text-decoration:none">careerrahnuma.com</a> \u00B7 Career and scholarship guidance built for Pakistan.</p>'
    + '</td></tr></table></td></tr></table></body></html>';
}

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
      service: 'send-report',
      configured: !!process.env.RESEND_API_KEY
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    res.status(500).json({ error: 'Email is not configured on the server' });
    return;
  }

  try {
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    /* ---------- TESTIMONIAL ---------- */
    if (body.type === 'testimonial') {
      if (!body.name || !body.story) {
        res.status(400).json({ error: 'Name and story are required' });
        return;
      }

      var att = [];
      if (body.photoBase64 && body.photoBase64.length > 100 && body.photoBase64.length < 2000000) {
        att.push({ filename: body.photoName || 'photo.jpg', content: body.photoBase64 });
      }

      var tHtml = '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:620px">'
        + '<h2 style="color:#0B5A54;margin:0 0 16px">New testimonial</h2>'
        + '<p style="margin:0 0 6px;font-size:14px"><strong>Name:</strong> ' + esc(body.name) + '</p>'
        + '<p style="margin:0 0 6px;font-size:14px"><strong>University:</strong> ' + esc(body.university) + '</p>'
        + '<p style="margin:0 0 6px;font-size:14px"><strong>Email:</strong> ' + esc(body.email) + '</p>'
        + '<p style="margin:0 0 16px;font-size:14px"><strong>Photo:</strong> ' + (att.length ? 'attached' : 'none') + '</p>'
        + '<div style="padding:16px;background:#F3F6F2;border-left:3px solid #D9673B;border-radius:8px;font-size:15px;line-height:1.65;white-space:pre-wrap">' + esc(body.story) + '</div></div>';

      var tPayload = {
        from: 'CareerRahnuma <admin@careerrahnuma.com>',
        to: ['admin@careerrahnuma.com'],
        subject: 'New testimonial from ' + body.name,
        html: tHtml
      };
      if (body.email) tPayload.reply_to = body.email;
      if (att.length) tPayload.attachments = att;

      var tRes = await sendMail(tPayload);

      /* Thank-you back to the person, with their shareable card attached */
      if (body.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) {
        var cardOk = !!(body.cardBase64 && body.cardBase64.length > 500 && body.cardBase64.length < 5000000);
        var thanks = {
          from: 'CareerRahnuma <admin@careerrahnuma.com>',
          to: [body.email],
          reply_to: 'admin@careerrahnuma.com',
          subject: 'Shukriya, ' + firstName(body.name),
          html: thankYouHtml(body.name, cardOk)
        };
        if (cardOk) {
          thanks.attachments = [{
            filename: 'CareerRahnuma-' + String(body.name || 'story').replace(/[^A-Za-z0-9]+/g, '-') + '.png',
            content: body.cardBase64
          }];
        }
        await sendMail(thanks);
      }

      if (!tRes.ok) {
        res.status(502).json({ error: 'Could not send', detail: String(tRes.body).slice(0, 200) });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    /* ---------- REPORT ---------- */
    var email = body.email;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address' });
      return;
    }
    if (!body.reportText || body.reportText.length < 20) {
      res.status(400).json({ error: 'Report is empty' });
      return;
    }

    var isCareer = body.mode === 'career';
    var title = isCareer ? 'Your Career Paths' : 'Your Scholarship Roadmap';

    var pdfAtt = [];
    if (body.pdfBase64 && body.pdfBase64.length > 100 && body.pdfBase64.length < 6000000) {
      pdfAtt.push({
        filename: 'CareerRahnuma-' + (isCareer ? 'Career-Paths' : 'Scholarship-Roadmap') + '.pdf',
        content: body.pdfBase64
      });
    }

    var payload = {
      from: 'CareerRahnuma <admin@careerrahnuma.com>',
      to: [email],
      reply_to: 'admin@careerrahnuma.com',
      subject: isCareer ? 'Your career paths from CareerRahnuma' : 'Your scholarship roadmap from CareerRahnuma',
      html: reportHtml(body.reportText, title)
    };
    if (pdfAtt.length) payload.attachments = pdfAtt;

    var out = await sendMail(payload);
    if (!out.ok) {
      var msg = 'Could not send the email';
      try {
        var p = JSON.parse(out.body);
        if (p && p.message) msg = p.message;
      } catch (e) {}
      res.status(502).json({ error: msg });
      return;
    }

    res.status(200).json({ ok: true });

  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + (err && err.message ? err.message : 'unknown') });
  }
};
