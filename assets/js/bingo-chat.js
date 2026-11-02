// Bingo chat: plutajući gumb s glavicom i prozor za razgovor s AI asistentom (/api/bingo).
// Povijest razgovora drži se samo u ovoj kartici preglednika (sessionStorage), bez kolačića.
(() => {
  const AVATAR = '/assets/bingo-ai/bingo-ai-avatar.svg';
  const KLJUC = 'bingo-chat';
  const POZDRAV = 'Bok! Ja sam Bingo, AI asistent TMBinga. Pitaj me o paketima, cijenama ili kako radimo, a ako želiš ponudu, proslijedit ću upit Tonćiju.';

  const css = `
.bc-gumb { position: fixed; z-index: 65; right: var(--gy, 16px); bottom: calc(max(16px, env(safe-area-inset-bottom, 0px)) + var(--bc-dolje, 0px)); width: 64px; height: 64px; border: 0; padding: 6px; background: #000; cursor: pointer; display: grid; place-items: center; transition: transform .3s cubic-bezier(.3,1.6,.5,1); }
.bc-gumb:hover { transform: translateY(-3px) rotate(-6deg); }
.bc-gumb img { width: 100%; height: 100%; }
.bc-gumb[aria-expanded="true"] { display: none; }
.bc-prozor { position: fixed; z-index: 75; right: var(--gy, 16px); bottom: max(16px, env(safe-area-inset-bottom, 0px)); width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100dvh - 32px)); background: #fff; color: #0b0b0b; border: 1px solid #000; display: grid; grid-template-rows: auto 1fr auto auto; font: 400 15px/1.45 var(--body, system-ui, sans-serif); box-shadow: 0 18px 50px rgba(0,0,0,.18); }
.bc-glava { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #000; color: #fff; }
.bc-glava img { width: 34px; height: 34px; }
.bc-glava b { font-weight: 600; display: block; }
.bc-glava small { font: 400 10px/1.2 var(--tech, ui-monospace, monospace); letter-spacing: .09em; text-transform: uppercase; color: #3faf7f; }
.bc-zatvori { margin-left: auto; background: none; border: 0; color: #fff; font-size: 22px; line-height: 1; cursor: pointer; padding: 4px 6px; }
.bc-poruke { overflow-y: auto; padding: 14px 12px; display: flex; flex-direction: column; gap: 10px; overscroll-behavior: contain; }
.bc-p { max-width: 85%; padding: 9px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.bc-p.bingo { align-self: flex-start; background: #e8f2f1; }
.bc-p.korisnik { align-self: flex-end; background: #0b0b0b; color: #fff; }
.bc-p.greska { align-self: flex-start; background: #fbeaea; }
.bc-p a { color: inherit; }
.bc-tipka { align-self: flex-start; background: #e8f2f1; padding: 12px 14px; display: flex; gap: 4px; }
.bc-tipka i { width: 6px; height: 6px; background: #083a35; border-radius: 50%; animation: bc-skok 1s infinite; }
.bc-tipka i:nth-child(2) { animation-delay: .15s; } .bc-tipka i:nth-child(3) { animation-delay: .3s; }
@keyframes bc-skok { 0%, 60%, 100% { transform: none; opacity: .4; } 30% { transform: translateY(-4px); opacity: 1; } }
.bc-unos { display: flex; border-top: 1px solid #000; }
.bc-unos textarea { flex: 1; resize: none; border: 0; padding: 12px; font: inherit; min-height: 46px; max-height: 120px; outline: none; background: #fff; color: #0b0b0b; }
.bc-unos button { border: 0; background: #3faf7f; color: #fff; padding: 0 16px; font: 600 12px/1 var(--tech, ui-monospace, monospace); letter-spacing: .09em; text-transform: uppercase; cursor: pointer; }
.bc-unos button:disabled { background: #b9c2bd; cursor: default; }
.bc-napomena { margin: 0; padding: 6px 12px 8px; font-size: 11px; color: #8a8a8a; }
.bc-napomena a { color: inherit; }
@media (prefers-reduced-motion: reduce) { .bc-gumb, .bc-tipka i { transition: none; animation: none; } }`;

  let poruke = [];
  try { poruke = JSON.parse(sessionStorage.getItem(KLJUC) || '[]'); } catch {}
  const spremi = () => { try { sessionStorage.setItem(KLJUC, JSON.stringify(poruke.slice(-30))); } catch {} };

  const el = (tag, attrs = {}, ...djeca) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) k === 'class' ? (e.className = v) : e.setAttribute(k, v);
    e.append(...djeca);
    return e;
  };

  // linkovi i e-mail adrese u odgovorima postaju klikabilni (tekst se ubacuje kao čvorovi, ne kao HTML)
  const sadrzaj = (tekst) => {
    const frag = document.createDocumentFragment();
    const re = /(https?:\/\/[^\s)]+[^\s).,!?]|[\w.+-]+@[\w-]+\.[\w.-]*\w)/g;
    let zadnji = 0, m;
    while ((m = re.exec(tekst))) {
      frag.append(tekst.slice(zadnji, m.index));
      const url = m[0].includes('@') && !m[0].startsWith('http') ? 'mailto:' + m[0] : m[0];
      frag.append(el('a', { href: url, target: url.startsWith('http') ? '_blank' : '_self', rel: 'noopener' }, m[0]));
      zadnji = m.index + m[0].length;
    }
    frag.append(tekst.slice(zadnji));
    return frag;
  };

  document.head.append(el('style', {}, css));

  const gumb = el('button', { class: 'bc-gumb', type: 'button', 'aria-label': 'Razgovaraj s Bingom, AI asistentom', 'aria-expanded': 'false', 'aria-controls': 'bc-prozor' }, el('img', { src: AVATAR, alt: '' }));
  const lista = el('div', { class: 'bc-poruke', 'aria-live': 'polite' });
  const polje = el('textarea', { rows: '1', placeholder: 'Napiši poruku…', 'aria-label': 'Poruka za Binga', maxlength: '2000' });
  const posalji = el('button', { type: 'submit' }, 'Pošalji');
  const zatvori = el('button', { class: 'bc-zatvori', type: 'button', 'aria-label': 'Zatvori chat' }, '×');
  const forma = el('form', { class: 'bc-unos' }, polje, posalji);
  const prozor = el('section', { class: 'bc-prozor', id: 'bc-prozor', role: 'dialog', 'aria-label': 'Chat s Bingom', hidden: '' },
    el('div', { class: 'bc-glava' }, el('img', { src: AVATAR, alt: '' }), el('div', {}, el('b', {}, 'Bingo'), el('small', {}, 'AI asistent · odgovara odmah')), zatvori),
    lista, forma,
    el('p', { class: 'bc-napomena' }, 'Bingo je AI i može pogriješiti. Tonći pregledava svaku ponudu. ', el('a', { href: '/privatnost.html' }, 'Privatnost')));
  document.body.append(gumb, prozor);

  // na uskim ekranima obavijest o kolačićima prekriva gumb, pa ga podignemo iznad nje dok je vidljiva
  const kolacic = document.getElementById('cookie');
  const pomakni = () => {
    let dolje = 0;
    if (kolacic && !kolacic.hidden) {
      const k = kolacic.getBoundingClientRect();
      if (k.right > window.innerWidth - 96) dolje = k.height + 12;
    }
    gumb.style.setProperty('--bc-dolje', dolje + 'px');
  };
  if (kolacic) {
    new MutationObserver(pomakni).observe(kolacic, { attributes: true, attributeFilter: ['hidden'] });
    if (window.ResizeObserver) new ResizeObserver(pomakni).observe(kolacic);
  }
  window.addEventListener('resize', pomakni);
  pomakni();

  const dodaj = (uloga, tekst) => {
    lista.append(el('div', { class: 'bc-p ' + uloga }, sadrzaj(tekst)));
    lista.scrollTop = lista.scrollHeight;
  };
  const iscrtaj = () => {
    lista.replaceChildren();
    dodaj('bingo', POZDRAV);
    poruke.forEach((p) => dodaj(p.uloga, p.tekst));
  };

  const otvori = () => {
    prozor.hidden = false;
    gumb.setAttribute('aria-expanded', 'true');
    if (!lista.childElementCount) iscrtaj();
    polje.focus();
  };
  const sakrij = () => {
    prozor.hidden = true;
    gumb.setAttribute('aria-expanded', 'false');
    gumb.focus();
  };

  gumb.addEventListener('click', otvori);
  zatvori.addEventListener('click', sakrij);
  prozor.addEventListener('keydown', (e) => { if (e.key === 'Escape') sakrij(); });
  document.querySelectorAll('[data-bingo-chat]').forEach((b) => {
    b.style.cursor = 'pointer';
    b.addEventListener('click', (e) => { e.preventDefault(); otvori(); });
  });

  polje.addEventListener('input', () => { polje.style.height = 'auto'; polje.style.height = polje.scrollHeight + 'px'; });
  polje.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); forma.requestSubmit(); }
  });

  forma.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tekst = polje.value.trim();
    if (!tekst || posalji.disabled) return;
    polje.value = '';
    polje.style.height = 'auto';
    poruke.push({ uloga: 'korisnik', tekst });
    spremi();
    dodaj('korisnik', tekst);

    posalji.disabled = true;
    const tipka = el('div', { class: 'bc-tipka', 'aria-label': 'Bingo piše' }, el('i'), el('i'), el('i'));
    lista.append(tipka);
    lista.scrollTop = lista.scrollHeight;
    try {
      const r = await fetch('/api/bingo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ poruke: poruke.slice(-30) }),
      });
      const d = await r.json().catch(() => ({}));
      tipka.remove();
      if (d.odgovor) {
        poruke.push({ uloga: 'bingo', tekst: d.odgovor });
        spremi();
        dodaj('bingo', d.odgovor);
      } else {
        poruke.pop();
        spremi();
        dodaj('greska', d.greska || 'Nešto nije u redu. Piši na info@tmbingo.com.');
      }
    } catch {
      tipka.remove();
      poruke.pop();
      spremi();
      dodaj('greska', 'Nema veze sa serverom. Provjeri internet ili piši na info@tmbingo.com.');
    } finally {
      posalji.disabled = false;
      polje.focus();
    }
  });
})();
