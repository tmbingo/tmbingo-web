// "Pozdrav, ja sam Bingo. Kako se zoveš?" ispod uvodne rečenice.
// Posjetitelj upiše ime, odabere "na ti" ili "na Vi" i rod, a tekstovi na stranici označeni s data-ti / data-vi
// prilagode se njemu (s imenom u vokativu). Sve ostaje samo u ovom pregledniku (localStorage), ništa se ne šalje.
//
// Oznake u HTML-u:
//   data-ti="…" data-vi="…"         tekst za "ti" i "Vi" (zadani sadržaj elementa je "ti" verzija bez imena)
//   data-ti-z / data-vi-z           ženska verzija, ako se razlikuje
//   [{vok}, ]                       dio u uglatim zagradama prikaže se samo kad znamo ime; {vok} je ime u vokativu
(() => {
  const KLJUC = 'bingo-osoba';

  // Imena na -a koja su muška, i ženska imena koja ne završavaju na -a (najčešća u Hrvatskoj)
  const MUSKA_NA_A = ['luka', 'nikola', 'ivica', 'jakša', 'jurica', 'perica', 'andrija', 'ilija', 'toma', 'kuzma', 'mihovila', 'joška', 'saša', 'matija', 'vanja', 'sava'];
  const ZENSKA_BEZ_A = ['ines', 'doris', 'karmen', 'nives', 'ingrid', 'dolores', 'edit', 'ester', 'mirjam', 'rut', 'ivon', 'nikol', 'kim'];
  const NEODREDJENA = ['saša', 'matija', 'vanja', 'andrea', 'kim', 'sava', 'nikol'];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const veliko = (s) => s.charAt(0).toLocaleUpperCase('hr') + s.slice(1);

  // Najbolja procjena roda iz imena; null kad ime može biti i muško i žensko.
  function procijeniRod(ime) {
    const i = ime.toLocaleLowerCase('hr');
    if (NEODREDJENA.includes(i)) return null;
    if (ZENSKA_BEZ_A.includes(i)) return 'z';
    if (i.endsWith('a') && !MUSKA_NA_A.includes(i)) return 'z';
    return 'm';
  }

  // Vokativ hrvatskih imena po najčešćim pravilima (Ivan → Ivane, Petar → Petre, Ivica → Ivice, Ana → Ana).
  function vokativ(ime, rod) {
    const i = ime.toLocaleLowerCase('hr');
    if (i.endsWith('ica')) return ime.slice(0, -1) + 'e';
    if (rod === 'z' || /[aeiou]$/.test(i)) return ime;
    if (/[td]ar$/.test(i) && i.length > 4) return ime.slice(0, -2) + 're';
    if (i.endsWith('k')) return ime.slice(0, -1) + 'če';
    if (i.endsWith('g')) return ime.slice(0, -1) + 'že';
    if (i.endsWith('h')) return ime.slice(0, -1) + 'še';
    if (/[jšžčćđ]$/.test(i)) return ime + 'u';
    return ime + 'e';
  }

  const ucitaj = () => { try { return JSON.parse(localStorage.getItem(KLJUC) || 'null'); } catch { return null; } };
  const spremi = (o) => { try { o ? localStorage.setItem(KLJUC, JSON.stringify(o)) : localStorage.removeItem(KLJUC); } catch {} };

  // Primijeni na sve elemente s data-ti / data-vi
  function primijeni(o) {
    document.querySelectorAll('[data-ti]').forEach((el) => {
      const oblik = o?.oblik === 'vi' ? 'vi' : 'ti';
      let t = (o?.rod === 'z' && el.dataset[oblik + 'Z']) || el.dataset[oblik] || el.dataset.ti;
      const imaIme = !!o?.ime;
      const naPocetku = t.startsWith('[');
      t = t.replace(/\[([^\]]*)\]/g, (_, dio) => (imaIme ? dio : ''));
      const html = el.dataset.html !== undefined;
      if (imaIme) t = t.replace(/\{vok\}/g, html ? esc(o.vok) : o.vok);
      if (naPocetku) t = veliko(t);
      if (html) el.innerHTML = t;
      else el.textContent = t;
    });
    document.documentElement.dataset.oblik = o?.oblik || 'ti';
    window.dispatchEvent(new CustomEvent('bingo-osoba', { detail: o }));
  }

  // Zapamti izvorne ("ti") sadržaje za elemente koji imaju HTML unutra (npr. <span class="g">)
  document.querySelectorAll('[data-ti]').forEach((el) => {
    if (el.children.length && el.dataset.html === undefined) el.dataset.html = '';
  });

  const kutija = document.getElementById('upoznaj');
  let osoba = ucitaj();
  window.BingoOsoba = { get: () => osoba, vokativ, procijeniRod };
  if (osoba) primijeni(osoba);
  if (!kutija) return;

  const oblak = kutija.querySelector('.up-oblak');
  const tijelo = kutija.querySelector('.up-tijelo');

  function zavrsi(ime, oblik, rod) {
    osoba = { ime, vok: vokativ(ime, rod), rod, oblik };
    spremi(osoba);
    primijeni(osoba);
    korakGotovo();
  }

  // Jedan korak: ime + "Na ti" ili "Na Vi". Rod se pogađa iz imena; samo za imena koja mogu biti
  // i muška i ženska (Saša, Matija…) Bingo jednim klikom pita još i to.
  function korakIme() {
    oblak.innerHTML = 'Pozdrav, ja sam Bingo! Kako se zoveš?';
    tijelo.innerHTML = `<form class="up-forma">
        <input name="ime" autocomplete="given-name" maxlength="30" placeholder="Upiši ime" aria-label="Tvoje ime" required>
        <button class="btn" type="submit" value="ti">Na ti</button>
        <button class="btn ghost" type="submit" value="vi">Na Vi</button>
      </form>`;
    const f = tijelo.querySelector('form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const ime = veliko(f.ime.value.trim().replace(/[^\p{L}\s'-]/gu, '').replace(/\s+/g, ' ').split(' ')[0] || '');
      if (!ime) return f.ime.focus();
      const oblik = e.submitter?.value === 'vi' ? 'vi' : 'ti';
      const rod = procijeniRod(ime);
      rod ? zavrsi(ime, oblik, rod) : korakRod(ime, oblik);
    });
  }

  function korakRod(ime, oblik) {
    const vi = oblik === 'vi';
    oblak.innerHTML = vi ? `Drago mi je, ${esc(ime)}! Da Vam pišem kao gospodinu ili gospođi?` : `Drago mi je, ${esc(ime)}! Da ti pišem kao muškarcu ili ženi?`;
    tijelo.innerHTML = `<div class="up-izbor">
        <button class="btn" type="button" data-rod="m">${vi ? 'Gospodinu' : 'Muškarcu'}</button>
        <button class="btn" type="button" data-rod="z">${vi ? 'Gospođi' : 'Ženi'}</button>
      </div>`;
    tijelo.querySelectorAll('[data-rod]').forEach((b) => b.addEventListener('click', () => zavrsi(ime, oblik, b.dataset.rod)));
  }

  function korakGotovo() {
    const { vok, rod, oblik } = osoba;
    oblak.innerHTML = oblik === 'vi'
      ? `Dobro došli, ${esc(vok)}! Stranica Vam se sada obraća na Vi.`
      : `${rod === 'z' ? 'Dobrodošla' : 'Dobrodošao'}, ${esc(vok)}! Stranica je sad pisana za tebe.`;
    tijelo.innerHTML = `<button class="up-promijeni" type="button">${oblik === 'vi' ? 'Promijenite' : 'Promijeni'}</button>`;
    tijelo.querySelector('button').addEventListener('click', () => {
      osoba = null;
      spremi(null);
      primijeni(null);
      korakIme();
      tijelo.querySelector('input').focus();
    });
  }

  osoba ? korakGotovo() : korakIme();
  kutija.hidden = false;
})();
