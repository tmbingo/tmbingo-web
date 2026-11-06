// POST /api/bingo { poruke: [{ uloga: 'korisnik' | 'bingo', tekst }] }
// Bingo, AI asistent na stranici: odgovara na pitanja o paketima i radu, a kad posjetitelj ostavi
// e-mail, šalje upit Tonćiju. Povijest razgovora čuva preglednik (samo tekst), server ništa ne sprema.
import Anthropic from '@anthropic-ai/sdk';
import { env, json, tijelo, mjesta, ADMIN_EMAIL, zapamtiOrigin, ipAdresa, uGranicama } from '../lib/zajednicko.mjs';
import { posalji, predlozak } from '../lib/posta.mjs';
import { PAKETI, MJESECNI, euri } from '../../app/paketi.mjs';

export const config = { path: '/api/bingo' };

const MAX_PORUKA = 30;      // poruka u jednom razgovoru
const MAX_ZNAKOVA = 2000;   // po poruci
const MAX_KORAKA = 4;       // krugova alata po odgovoru

// Ograničenja se pamte u bazi (vrijede za sve instance funkcije): po IP-u i ukupno dnevno,
// da netko ne može trošiti Anthropic kredite bez kraja. Ukupni dnevni broj mijenja se s BINGO_DNEVNO.
const DNEVNO = () => parseInt(env('BINGO_DNEVNO', '500'), 10) || 500;

const opisPaketa = () =>
  Object.entries(PAKETI)
    .map(([kljuc, p]) => {
      const cijena = p.jednokratno
        ? `${euri(p.jednokratno)} jednokratno`
        : `${euri(p.mjesecno)} mjesečno ili ${euri(p.godisnje)} godišnje (2 mjeseca gratis)`;
      return `- ${p.naziv} (${kljuc}): ${cijena}. ${p.kratko}. ${p.stavke.join('; ')}.${p.mjesta > 1 ? ` Zauzima ${p.mjesta} mjesta.` : ''}`;
    })
    .join('\n');

const SUSTAV = `Ti si Bingo, AI asistent TMBinga (tmbingo.com), kreativnog tima u jednom paketu: web, dizajn i društvene mreže za jednu mjesečnu cijenu. Razgovaraš s posjetiteljima u chatu na stranici.

O tebi i o timu:
- Uvijek si iskren da si AI asistent. Od milja te zovu "AE asistent", jer je AE u Dalmaciji odgovor na sve.
- Ti odgovaraš na upite i pišeš prve verzije tekstova. Tonći, dizajner i programer s 20 godina iskustva, svaki tekst pregleda i odobri, a dizajn i izradu radi osobno.
- TMBingo je usluga obrta Studio23k, vl. Tonći Morić, Jakova Gotovca 18, 23000 Zadar. Obrt nije u sustavu PDV-a, pa su sve cijene konačne.

Paketi:
${opisPaketa()}
Paketi se naručuju na stranici, u sekciji "Paket" (tmbingo.com/#paket), gumbom "Odaberi".

U svakom mjesečnom paketu: jedan zahtjev dnevno, objave gotove za 48 sati, neograničeno brendova i slika, logo s neograničenim revizijama, dva korisnika.
Usluge: web stranice, logo, branding, društvene mreže, tiskani materijali, web banneri, newsletter, SEO, hosting, održavanje.

Kako radimo: 1) upit e-mailom i brief (Bingo), 2) prijedlog u Figmi (Tonći), 3) odobrenje i ispravci (klijent), 4) kodiranje uz pomoć AI-ja (Tonći), 5) objava, hosting i održavanje (Tonći). Objave za društvene mreže radi dizajner, ne AI.

Česta pitanja:
- Bez obveze trajanja: pauza ili otkaz bilo kada, bez penala, otkaz vrijedi od idućeg mjeseca. Detalji: tmbingo.com/uvjeti.html
- Povoljno je jer administraciju, tekstove i komunikaciju radi AI, pa Tonći dizajnira umjesto da piše mailove.
- Najviše 10 novih klijenata mjesečno, jer dizajn radi čovjek. Kad su mjesta popunjena, klijent ide na listu za idući mjesec. Koliko je mjesta slobodno, provjeri alatom slobodna_mjesta.
- Komunikacija ide e-mailom zbog transparentnosti: svaki dogovor, rok i izmjena ostaju zapisani.

Kontakt: info@tmbingo.com, odgovor isti dan. Video poziv od 30 minuta: https://calendar.app.google/jx4eBT3Tn9bsoiSt9

Kako odgovaraš:
- Na jeziku na kojem ti posjetitelj piše (najčešće hrvatski). Persiraš samo ako posjetitelj persira, inače "ti".
- Kratko i toplo, 1 do 4 rečenice, bez naslova i tablica. Smiješ biti malo duhovit, dalmatinski, ali ne pretjeruj.
- Preporuči paket prema onome što posjetitelj treba.
- Ne izmišljaj cijene, rokove, popuste ni usluge kojih nema gore. Za posebne ponude, rokove ili nešto što ne znaš, reci da će Tonći odgovoriti i ponudi da proslijediš upit.
- Kad posjetitelj želi ponudu, suradnju ili da ga netko kontaktira, pitaj ime i e-mail pa pozovi alat posalji_upit, s kratkim sažetkom što treba. Upit pošalji samo uz e-mail koji je posjetitelj sam napisao, i javi mu da je poslano.
- Ne pomažeš s temama koje nisu vezane uz TMBingo, dizajn, web ili marketing; ljubazno vrati razgovor na to.`;

// Ime, oblik obraćanja i rod koje je posjetitelj odabrao u pozdravu na stranici. Prvi blok (SUSTAV) ostaje
// isti za sve, pa se može keširati; podaci o posjetitelju idu u drugi, kratki blok.
const cisto = (v, n) => String(v ?? '').replace(/[^\p{L}\s'-]/gu, '').trim().slice(0, n);
function sustav(osoba) {
  const blokovi = [{ type: 'text', text: SUSTAV, cache_control: { type: 'ephemeral' } }];
  const ime = cisto(osoba?.ime, 30);
  if (!ime) return blokovi;
  const vok = cisto(osoba?.vok, 32) || ime;
  const vi = osoba?.oblik === 'vi';
  const zensko = osoba?.rod === 'z';
  blokovi.push({
    type: 'text',
    text: `Posjetitelj se na stranici predstavio kao ${ime} (vokativ: ${vok}). ` +
      (vi ? 'Želi da mu/joj se obraćaš s "Vi" (veliko V), pristojno i bez "ti" oblika. ' : 'Obraćaj se s "ti". ') +
      (zensko ? 'To je žena: kad se u rečenici vidi rod, piši u ženskom rodu' : 'To je muškarac: kad se u rečenici vidi rod, piši u muškom rodu') +
      (vi ? ' (uz Vi vrijedi standardno pristojno obraćanje u množini, npr. "jeste li zadovoljni"). ' : '. ') +
      'Ime koristi povremeno, prirodno, ne u svakoj poruci.',
  });
  return blokovi;
}

const ALATI = [
  {
    name: 'slobodna_mjesta',
    description: 'Vraća koliko je mjesta za nove klijente još slobodno ovaj mjesec.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'posalji_upit',
    description: 'Šalje Tonćiju upit posjetitelja e-mailom. Koristi samo kad posjetitelj želi da ga se kontaktira i sam je napisao svoj e-mail.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        ime: { type: 'string', description: 'Ime posjetitelja, ili prazno ako ga nije rekao.' },
        email: { type: 'string', description: 'E-mail adresa koju je posjetitelj napisao.' },
        paket: { type: 'string', enum: [...Object.keys(PAKETI), 'nije_odluceno'] },
        sazetak: { type: 'string', description: 'Kratak sažetak što posjetitelj treba, na hrvatskom.' },
      },
      required: ['ime', 'email', 'paket', 'sazetak'],
      additionalProperties: false,
    },
  },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function izvrsi(alat, ulaz, poruke, ip) {
  if (alat === 'slobodna_mjesta') {
    const m = await mjesta();
    return `Slobodno ${m.slobodno} od ${m.max} mjesta ovaj mjesec.`;
  }
  if (alat === 'posalji_upit') {
    const email = String(ulaz.email || '').trim();
    if (!EMAIL.test(email)) return { greska: 'E-mail adresa nije ispravna. Zamoli posjetitelja da je provjeri.' };
    // e-mail mora stvarno biti u porukama posjetitelja, da model ne izmisli adresu
    if (!poruke.some((p) => p.role === 'user' && typeof p.content === 'string' && p.content.toLowerCase().includes(email.toLowerCase())))
      return { greska: 'Posjetitelj nije napisao tu e-mail adresu. Pitaj ga za e-mail.' };
    if (!(await uGranicama([[`bingo-upit:ip:${ip}`, 2, 86400], ['bingo-upit:sve', 20, 86400]])))
      return { greska: 'Upit je već poslan. Ako treba još nešto, neka posjetitelj piše na info@tmbingo.com.' };
    const paket = PAKETI[ulaz.paket]?.naziv || 'nije odlučeno';
    const razgovor = poruke
      .filter((p) => typeof p.content === 'string')
      .map((p) => `${p.role === 'user' ? 'Posjetitelj' : 'Bingo'}: ${p.content}`)
      .join('\n\n');
    try {
      const poslano = await posalji({
        to: ADMIN_EMAIL(),
        replyTo: email,
        subject: `Bingo chat: upit od ${ulaz.ime || email}`,
        ...predlozak({
          naslov: 'Novi upit iz chata',
          odlomci: [`${ulaz.ime || 'Posjetitelj'} · ${email}`, `Paket: ${paket}`, ulaz.sazetak, `Razgovor:\n\n${razgovor.slice(-6000)}`],
        }),
      });
      if (!poslano) return { greska: 'Slanje e-pošte trenutno ne radi. Predloži posjetitelju da piše na info@tmbingo.com.' };
      return 'Upit je poslan Tonćiju. Odgovor stiže e-mailom, obično isti dan.';
    } catch (e) {
      console.error('[bingo] upit nije poslan', e);
      return { greska: 'Slanje nije uspjelo. Predloži posjetitelju da piše na info@tmbingo.com.' };
    }
  }
  return { greska: 'Nepoznat alat.' };
}

const tekstOdgovora = (content) =>
  content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

let klijent;

export default async (req) => {
  zapamtiOrigin(req);
  if (req.method !== 'POST') return json(405, { greska: 'Metoda nije dopuštena.' });

  const ip = ipAdresa(req);
  if (!(await uGranicama([[`bingo:ip:${ip}`, 20, 600], [`bingo:ip-dan:${ip}`, 80, 86400]])))
    return json(429, { greska: 'Puno poruka u kratkom vremenu. Probaj opet za par minuta ili piši na info@tmbingo.com.' });
  if (!(await uGranicama([['bingo:sve', DNEVNO(), 86400]])))
    return json(429, { greska: 'Bingo je danas imao puno razgovora i odmara do sutra. Piši nam na info@tmbingo.com, javljamo se isti dan.' });

  const { poruke: ulaz, osoba } = await tijelo(req);
  if (!Array.isArray(ulaz) || !ulaz.length || ulaz.length > MAX_PORUKA)
    return json(400, { greska: 'Razgovor je predug. Osvježi stranicu ili piši na info@tmbingo.com.' });

  const poruke = ulaz.map((p) => ({
    role: p?.uloga === 'bingo' ? 'assistant' : 'user',
    content: String(p?.tekst ?? '').slice(0, MAX_ZNAKOVA),
  }));
  if (poruke[0].role !== 'user' || poruke.at(-1).role !== 'user' || poruke.some((p) => !p.content.trim()))
    return json(400, { greska: 'Neispravna poruka.' });

  if (!env('ANTHROPIC_API_KEY'))
    return json(200, { odgovor: 'Bok! Ja sam Bingo, AI asistent. Chat još nije uključen, pa mi piši na info@tmbingo.com i javit ćemo se isti dan.' });

  klijent ??= new Anthropic({ apiKey: env('ANTHROPIC_API_KEY'), timeout: 25_000, maxRetries: 1 });
  const razgovor = [...poruke];

  try {
    for (let korak = 0; korak < MAX_KORAKA; korak++) {
      const odgovor = await klijent.beta.messages.create({
        model: env('BINGO_MODEL', 'claude-opus-5-5'),
        max_tokens: 4000,
        output_config: { effort: env('BINGO_EFFORT', 'low') },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: sustav(osoba),
        tools: ALATI,
        messages: razgovor,
      });

      if (odgovor.stop_reason === 'refusal')
        return json(200, { odgovor: 'Na to ne mogu odgovoriti. Ako trebaš pomoć oko weba, dizajna ili društvenih mreža, tu sam!' });

      if (odgovor.stop_reason !== 'tool_use')
        return json(200, { odgovor: tekstOdgovora(odgovor.content) || 'Hmm, nešto mi je pobjeglo. Možeš li ponoviti?' });

      // cijeli sadržaj (i thinking blokove) vraćamo nepromijenjen
      razgovor.push({ role: 'assistant', content: odgovor.content });
      const rezultati = [];
      for (const b of odgovor.content) {
        if (b.type !== 'tool_use') continue;
        const r = await izvrsi(b.name, b.input || {}, poruke, ip);
        rezultati.push(
          typeof r === 'string'
            ? { type: 'tool_result', tool_use_id: b.id, content: r }
            : { type: 'tool_result', tool_use_id: b.id, content: r.greska, is_error: true },
        );
      }
      razgovor.push({ role: 'user', content: rezultati });
    }
    return json(200, { odgovor: 'Ovo mi je potrajalo. Piši na info@tmbingo.com pa ti Tonći odgovori isti dan.' });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.error('[bingo] rate limit', e.message);
    else if (e instanceof Anthropic.APIError) console.error('[bingo] API', e.status, e.message);
    else console.error('[bingo]', e);
    return json(502, { greska: 'Bingo je trenutno na pauzi za kavu. Piši na info@tmbingo.com i javit ćemo se isti dan.' });
  }
};
