// Slanje e-pošte preko Gmaila (SMTP s lozinkom za aplikacije) i jednostavan predložak u stilu stranice.
import nodemailer from 'nodemailer';
import { env, SITE } from './zajednicko.mjs';

let transport;

export async function posalji({ to, subject, text, html, attachments, replyTo }) {
  if (!env('SMTP_USER') || !env('SMTP_PASS')) {
    console.log('[posta] SMTP nije postavljen, e-mail nije poslan:', to, subject);
    return false;
  }
  transport ??= nodemailer.createTransport({
    host: env('SMTP_HOST', 'smtp.gmail.com'),
    port: parseInt(env('SMTP_PORT', '465'), 10),
    secure: env('SMTP_PORT', '465') === '465',
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
  });
  await transport.sendMail({
    from: env('MAIL_FROM', `TMBingo <${env('SMTP_USER')}>`),
    to, subject, text, html, attachments,
    replyTo: replyTo || env('MAIL_REPLY_TO', 'info@tmbingo.com'),
  });
  return true;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// odlomci: niz stringova (običan tekst) ili { html } za već pripremljen HTML
export function predlozak({ naslov, odlomci = [], gumb, dodatak = '' }) {
  const p = odlomci
    .map((o) => `<p style="margin:0 0 14px;font:16px/1.55 Helvetica,Arial,sans-serif;color:#0b0b0b">${typeof o === 'string' ? esc(o).replace(/\n/g, '<br>') : o.html}</p>`)
    .join('');
  const g = gumb
    ? `<p style="margin:24px 0"><a href="${esc(gumb.href)}" style="display:inline-block;background:#0b0b0b;color:#fff;text-decoration:none;font:600 13px/1 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:14px 18px">${esc(gumb.tekst)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="hr"><body style="margin:0;background:#f4f4f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff">
<tr><td style="background:#000;padding:18px 24px;font:600 13px/1 Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#fff">TMBingo</td></tr>
<tr><td style="padding:28px 24px 8px">
<h1 style="margin:0 0 18px;font:700 26px/1.15 Helvetica,Arial,sans-serif;letter-spacing:-.02em;color:#0b0b0b">${esc(naslov)}</h1>
${p}${g}${dodatak}
</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e5e5e5;font:12px/1.5 Helvetica,Arial,sans-serif;color:#8a8a8a">TMBingo je usluga obrta Studio23k, vl. Tonći Morić, Jakova Gotovca 18, Zadar · <a href="${SITE()}" style="color:#8a8a8a">tmbingo.com</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = [naslov, '', ...odlomci.map((o) => (typeof o === 'string' ? o : o.text || '')), gumb ? `${gumb.tekst}: ${gumb.href}` : '']
    .join('\n\n')
    .trim();
  return { html, text };
}

export { esc };
