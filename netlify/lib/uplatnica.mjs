// Podaci za uplatu: HUB3 barkod (PDF417, hrvatske banke) i EPC QR kod (SEPA, Revolut i EU banke).
import bwipjs from 'bwip-js/node';
import { env, demo } from './zajednicko.mjs';

// Primjer IBAN-a iz HUB3 uputa, samo za demo (stranica ga jasno označava kao primjer).
const DEMO_IBAN = 'HR1210010051863000160';
// Račun obrta Studio23k (OTP banka). Može se promijeniti varijablom IBAN u Netlifyju.
const IBAN = 'HR7824070001100756977';

export function primatelj() {
  return {
    ime: env('PRIMATELJ_IME', 'Studio23k, vl. T. Morić'),
    adresa: env('PRIMATELJ_ADRESA', 'Jakova Gotovca 18'),
    mjesto: env('PRIMATELJ_MJESTO', '23000 Zadar'),
    iban: env('IBAN', demo() ? DEMO_IBAN : IBAN).replace(/\s+/g, '').toUpperCase(),
    revolut: env('REVOLUT_LINK'),
  };
}

// Barkodovi se čitaju sigurnije bez dijakritika.
const ascii = (s, max) =>
  String(s || '')
    .replace(/[čćČĆ]/g, (c) => (c === c.toLowerCase() ? 'c' : 'C'))
    .replace(/đ/g, 'dj').replace(/Đ/g, 'Dj')
    .replace(/š/g, 's').replace(/Š/g, 'S')
    .replace(/ž/g, 'z').replace(/Ž/g, 'Z')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

export const iznosTekst = (centi) => (centi / 100).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// Format HRVHUB30, polja i duljine prema HUB3 standardu (HUB, 2. 2020.).
export function hub3({ centi, platitelj, poziv, opis }) {
  const p = primatelj();
  return [
    'HRVHUB30',
    'EUR',
    String(centi).padStart(15, '0'),
    ascii(platitelj.ime, 30),
    ascii(platitelj.adresa, 27),
    ascii(platitelj.mjesto, 27),
    ascii(p.ime, 25),
    ascii(p.adresa, 25),
    ascii(p.mjesto, 27),
    p.iban,
    'HR00',
    ascii(poziv, 22),
    'SCVE',
    ascii(opis, 35),
  ].join('\n') + '\n';
}

// EPC069-12 (SEPA Credit Transfer QR).
export function epc({ centi, poziv, opis }) {
  const p = primatelj();
  return [
    'BCD', '002', '1', 'SCT', '',
    ascii(p.ime, 70),
    p.iban,
    'EUR' + (centi / 100).toFixed(2),
    '', '',
    ascii(`${opis} ${poziv}`, 140),
  ].join('\n');
}

const opcije = {
  hub3: (text) => ({ bcid: 'pdf417', text, columns: 9, eclevel: 4, rowmult: 4, scale: 2, paddingwidth: 8, paddingheight: 8, backgroundcolor: 'FFFFFF' }),
  qr: (text) => ({ bcid: 'qrcode', text, eclevel: 'M', scale: 4, paddingwidth: 8, paddingheight: 8, backgroundcolor: 'FFFFFF' }),
};

export function svg(vrsta, text) {
  return bwipjs.toSVG(opcije[vrsta](text));
}
export function png(vrsta, text) {
  return bwipjs.toBuffer({ ...opcije[vrsta](text), scale: vrsta === 'qr' ? 6 : 3 });
}

// Sve što stranica i e-mail trebaju za jednu uplatu.
export function podaciZaUplatu({ centi, platitelj, poziv, opis }) {
  const p = primatelj();
  const tHub = hub3({ centi, platitelj, poziv, opis });
  const tEpc = epc({ centi, poziv, opis });
  return {
    iznos: iznosTekst(centi),
    centi,
    primatelj: { ime: p.ime, adresa: p.adresa, mjesto: p.mjesto },
    iban: p.iban,
    model: 'HR00',
    poziv,
    opis,
    revolut: p.revolut || null,
    primjer: demo(),
    hub3Svg: p.iban.startsWith('HR') ? svg('hub3', tHub) : null,
    qrSvg: svg('qr', tEpc),
    _tekst: { hub3: tHub, epc: tEpc },
  };
}
