/* Prikaz podataka za uplatu (narudžba paketa i produljenje). Koriste ga /paket/ i /app/. */
window.TMB_UPLATA = function (u) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var row = function (k, v, copy) {
    return '<dt class="lbl">' + k + '</dt><dd><span>' + esc(v) + '</span>' + (copy ? '<button type="button" data-copy="' + esc(copy) + '">Kopiraj</button>' : '') + '</dd>';
  };
  var ibanLijepo = String(u.iban || '').replace(/(.{4})/g, '$1 ').trim();
  return (u.primjer ? '<p class="primjer">Ovo je primjer. Podaci za uplatu još nisu postavljeni, zato ništa ne uplaćuj.</p>' : '') +
    '<div class="slip">' +
      '<dl>' +
        row('Iznos', u.iznos, String(u.iznos).replace(/\s*€/, '')) +
        row('Primatelj', u.primatelj.ime + ', ' + u.primatelj.adresa + ', ' + u.primatelj.mjesto) +
        row('IBAN', ibanLijepo, u.iban) +
        row('Model', u.model) +
        row('Poziv na broj', u.poziv, u.poziv) +
        row('Opis plaćanja', u.opis, u.opis) +
      '</dl>' +
      '<div class="codes">' +
        (u.hub3Svg ? '<div class="code"><p class="lbl dim">Barkod za hrvatske banke</p><div class="img">' + u.hub3Svg + '</div><p class="hint">U aplikaciji banke odaberi „Skeniraj uplatnicu“ (Slikaj i plati).</p></div>' : '') +
        (u.qrSvg ? '<div class="code qr"><p class="lbl dim">QR kod za Revolut i europske banke</p><div class="img">' + u.qrSvg + '</div></div>' : '') +
        (u.revolut ? '<a class="btn ghost" href="' + esc(u.revolut) + '" target="_blank" rel="noopener">Plati karticom (Revolut)</a>' : '') +
      '</div>' +
    '</div>';
};

document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-copy]');
  if (!b) return;
  var v = b.getAttribute('data-copy');
  (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () {
    var t = b.textContent; b.textContent = 'Kopirano'; setTimeout(function () { b.textContent = t; }, 1400);
  }).catch(function () { window.prompt('Kopiraj:', v); });
});
