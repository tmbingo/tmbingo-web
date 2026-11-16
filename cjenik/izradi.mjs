// Napravi CSV cjenik i tablicu na /cjenik/ iz app/cjenik.mjs.
// Pokreni iz korijena repozitorija:  node cjenik/izradi.mjs
//
// Što radi:
//  - cjenik/<OIB>_ZA_SVA_PRODAJNA_MJESTA_USLUGE_<broj>_<GGGGMMDD_SSMM>.csv  (ime kakvo traži pravilnik)
//  - cjenik/cjenik.csv  (ista datoteka na stalnoj adresi, za ljude i automatske provjere)
//  - stari CSV-ovi s drugim imenom sele u cjenik/arhiv/ (moraju ostati dostupni barem 15 dana)
//  - tablica i poveznice u cjenik/index.html između oznaka CJENIK:POCETAK i CJENIK:KRAJ
import { readFileSync, writeFileSync, readdirSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { STAVKE, GRUPE, OBRT, VRIJEDI_OD, eur, datumHr, imeCsv } from '../app/cjenik.mjs';

const MAPA = new URL('./', import.meta.url);
const ime = imeCsv();

// CSV: UTF-8, stupci odvojeni točkom sa zarezom, decimalni zarez
const polje = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const iznos = (n) => n.toFixed(2).replace('.', ',');
const zaglavlje = ['Naziv usluge', 'Maloprodajna cijena (EUR)', 'Posebni oblik prodaje', 'Bazna cijena (EUR)', 'Datum bazne cijene', 'Opseg usluge', 'Jedinica', 'Šifra'];
const redovi = STAVKE.map((s) => [
  s.naziv + (s.od ? ' (cijena od)' : ''),
  iznos(s.cijena),
  s.akcija || 'Ne',
  iznos(s.bazna),
  datumHr(s.datum),
  s.opseg,
  s.jedinica,
  s.sifra,
]);
const csv = [zaglavlje, ...redovi].map((r) => r.map(polje).join(';')).join('\r\n') + '\r\n';

mkdirSync(new URL('arhiv/', MAPA), { recursive: true });
for (const f of readdirSync(MAPA)) {
  if (/^\d{11}_.*\.csv$/.test(f) && f !== ime) renameSync(new URL(f, MAPA), new URL('arhiv/' + f, MAPA));
}
writeFileSync(new URL(ime, MAPA), csv);
writeFileSync(new URL('cjenik.csv', MAPA), csv);

// tablica za stranicu
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let html = '';
for (const [g, naslov] of Object.entries(GRUPE)) {
  const st = STAVKE.filter((s) => s.grupa === g);
  html += `\n<h2>${esc(naslov)}</h2>\n<table class="cj">\n  <thead><tr><th>Usluga</th><th>Cijena</th><th>Bazna cijena</th></tr></thead>\n  <tbody>\n`;
  for (const s of st) {
    const od = s.od ? 'od ' : '';
    html += `    <tr id="${s.sifra.toLowerCase()}"><td><b>${esc(s.naziv)}</b><br><span class="dim">${esc(s.opseg)}</span></td>` +
      `<td class="n">${od}${eur(s.cijena)}<br><span class="dim">${esc(s.jedinica)}</span></td>` +
      `<td class="n">${od}${eur(s.bazna)}<br><span class="dim">na dan ${datumHr(s.datum)}</span></td></tr>\n`;
  }
  html += '  </tbody>\n</table>\n';
}
html += `<p class="lbl dim">Cjenik vrijedi od ${datumHr(VRIJEDI_OD.datum)} · ${esc(OBRT.naziv)} · OIB ${OBRT.oib} · ${esc(OBRT.adresa)}</p>\n` +
  `<p class="cta"><a class="btn" href="/cjenik/${ime}" download>Preuzmi cjenik (CSV)</a><a class="btn ghost" href="/cjenik/cjenik.csv">Stalna adresa cjenika</a></p>\n`;

const str = new URL('index.html', MAPA);
const stranica = readFileSync(str, 'utf8');
const novo = stranica.replace(/(<!-- CJENIK:POCETAK -->)[\s\S]*?(<!-- CJENIK:KRAJ -->)/, `$1${html}$2`);
if (novo === stranica && !stranica.includes('CJENIK:POCETAK')) throw new Error('U cjenik/index.html nema oznaka CJENIK:POCETAK i CJENIK:KRAJ');
writeFileSync(str, novo);

console.log('Gotovo:', ime, '·', STAVKE.length, 'stavki');
if (!existsSync(new URL('arhiv/', MAPA))) console.log('(arhiv je prazan)');
