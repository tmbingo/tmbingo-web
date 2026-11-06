/* Cloudflare Turnstile (provjera da nije bot) za javne forme: narudžba paketa i upit za uslugu.
   Uključuje se upisom turnstileSiteKey u app/config.js (i TURNSTILE_SECRET na Netlifyju). Dok je prazan, ne radi ništa.
   Upotreba: var c = TMB_CAPTCHA(elementZaWidget); ... d.captcha = await c.token(); ... nakon greške c.reset(); */
window.TMB_CAPTCHA = function (el) {
  var key = (window.TMB_CONFIG || {}).turnstileSiteKey;
  if (!key || !el) return { token: function () { return Promise.resolve(''); }, reset: function () {} };
  var id = null;
  function crtaj() {
    id = window.turnstile.render(el, { sitekey: key, language: 'hr', appearance: 'interaction-only' });
  }
  if (window.turnstile) crtaj();
  else {
    var cb = 'tmbTurnstile' + Math.random().toString(36).slice(2);
    window[cb] = crtaj;
    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=' + cb;
    s.async = true;
    document.head.appendChild(s);
  }
  return {
    // čeka do 8 s da provjera završi (obično traje sekundu, a dok posjetitelj ispunjava formu već je gotova)
    token: async function () {
      for (var i = 0; i < 40; i++) {
        var t = id !== null && window.turnstile ? window.turnstile.getResponse(id) : '';
        if (t) return t;
        await new Promise(function (r) { setTimeout(r, 200); });
      }
      return '';
    },
    reset: function () { if (id !== null && window.turnstile) window.turnstile.reset(id); },
  };
};
