// Odabir paketa i načina plaćanja (mjesečno ili godišnje). Koriste ga /paket/ i TMBingo prostor.
import { PAKETI, MJESECNI, cijena, euri } from './paketi.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function odabir(root, { paket = 'tmbingo', period = 'mjesecno', samoMjesecni = false, onChange = () => {} } = {}) {
  const kljucevi = samoMjesecni ? MJESECNI : Object.keys(PAKETI);
  if (!kljucevi.includes(paket)) paket = 'tmbingo';
  if (period !== 'godisnje') period = 'mjesecno';

  root.innerHTML =
    '<div class="period lbl" role="radiogroup" aria-label="Način plaćanja">' +
    '<button type="button" data-p="mjesecno" role="radio">Mjesečno</button>' +
    '<button type="button" data-p="godisnje" role="radio">Godišnje <span>2 mjeseca gratis</span></button></div>' +
    '<div class="plans" role="radiogroup" aria-label="Paket">' +
    kljucevi.map((k) => {
      const p = PAKETI[k];
      return `<label class="plan${p.istaknut ? ' top' : ''}"><input type="radio" name="paket" value="${k}">` +
        (p.istaknut ? '<span class="badge lbl">Najčešći izbor</span>' : '') +
        `<span class="lbl">${esc(p.naziv)}</span><b class="iznos" data-k="${k}"></b><span class="kratko">${esc(p.kratko)}</span>` +
        `<ul>${p.stavke.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></label>`;
    }).join('') + '</div>';

  const crtaj = () => {
    root.querySelectorAll('.period button').forEach((b) => {
      const on = b.dataset.p === period;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    });
    root.querySelectorAll('.iznos').forEach((el) => {
      const p = PAKETI[el.dataset.k];
      el.innerHTML = p.jednokratno
        ? `${euri(p.jednokratno)}<small>jednokratno</small>`
        : period === 'godisnje'
          ? `${euri(p.godisnje)}<small>godišnje · ${euri(Math.round(p.godisnje / 12))} mj.</small>`
          : `${euri(p.mjesecno)}<small>mjesečno</small>`;
    });
    root.querySelectorAll('input[name=paket]').forEach((i) => {
      i.checked = i.value === paket;
      i.closest('.plan').classList.toggle('on', i.checked);
    });
    const p = PAKETI[paket];
    const per = p.jednokratno ? 'jednokratno' : period;
    onChange({ paket, period: per, centi: cijena(paket, per), naziv: p.naziv, p });
  };

  root.querySelectorAll('.period button').forEach((b) => b.addEventListener('click', () => { period = b.dataset.p; crtaj(); }));
  root.querySelectorAll('input[name=paket]').forEach((i) => i.addEventListener('change', () => { paket = i.value; crtaj(); }));
  crtaj();
  return { get: () => ({ paket, period: PAKETI[paket].jednokratno ? 'jednokratno' : period }) };
}

export { PAKETI, euri };
