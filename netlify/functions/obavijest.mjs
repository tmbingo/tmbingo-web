// POST /api/obavijest { vrsta, zadatak_id, poruka_id? }
// E-mail obavijesti: novi zadatak (adminu), nova poruka (drugoj strani), zadatak završen (klijentu).
import { baza, demo, json, tijelo, prijavljeni, trajanje, ADMIN_EMAIL, SITE } from '../lib/zajednicko.mjs';
import { posalji, predlozak } from '../lib/posta.mjs';

export const config = { path: '/api/obavijest' };

const isjecak = (s, n = 600) => (s.length > n ? s.slice(0, n) + '…' : s);

export default async (req) => {
  if (req.method !== 'POST') return json(405, { greska: 'Metoda nije dopuštena.' });
  if (demo()) return json(200, { ok: true, demo: true });
  const ja = await prijavljeni(req);
  if (!ja) return json(401, { greska: 'Prijava je istekla.' });

  const { vrsta, zadatak_id, poruka_id } = await tijelo(req);
  const db = baza();
  const { data: z } = await db.from('zadaci').select('*, klijent:profiles!zadaci_klijent_id_fkey(email, ime, tvrtka)').eq('id', zadatak_id).single();
  if (!z || (!ja.is_admin && z.klijent_id !== ja.id)) return json(404, { greska: 'Zadatak ne postoji.' });

  const link = `${SITE()}/app/#/zadatak/${z.id}`;
  const klijent = z.klijent?.ime || z.klijent?.email;
  let poruka;

  if (vrsta === 'zadatak' && !ja.is_admin) {
    poruka = {
      to: ADMIN_EMAIL(), replyTo: z.klijent.email,
      subject: `Novi zadatak #${z.id}: ${z.naslov}`,
      ...predlozak({ naslov: `Novi zadatak #${z.id}`, odlomci: [`${klijent}${z.klijent?.tvrtka ? ', ' + z.klijent.tvrtka : ''}`, z.naslov, isjecak(z.opis)], gumb: { tekst: 'Otvori zadatak', href: link } }),
    };
  } else if (vrsta === 'poruka') {
    const { data: p } = await db.from('poruke').select('*').eq('id', poruka_id).eq('zadatak_id', z.id).single();
    if (!p || p.autor_id !== ja.id) return json(404, { greska: 'Poruka ne postoji.' });
    poruka = ja.is_admin
      ? { to: z.klijent.email, subject: `TMBingo: nova poruka u zadatku #${z.id}`, ...predlozak({ naslov: `Nova poruka: ${z.naslov}`, odlomci: [isjecak(p.tekst) || 'Poslali smo ti datoteku.'], gumb: { tekst: 'Odgovori u TMBingo prostoru', href: link } }) }
      : { to: ADMIN_EMAIL(), replyTo: z.klijent.email, subject: `Poruka #${z.id} od ${klijent}: ${z.naslov}`, ...predlozak({ naslov: `Nova poruka od ${klijent}`, odlomci: [z.naslov, isjecak(p.tekst) || 'Poslana je datoteka.'], gumb: { tekst: 'Otvori zadatak', href: link } }) };
  } else if (vrsta === 'zavrseno' && ja.is_admin && z.status === 'zavrseno') {
    poruka = {
      to: z.klijent.email,
      subject: `TMBingo: zadatak #${z.id} je završen`,
      ...predlozak({
        naslov: 'Zadatak je završen',
        odlomci: [`Bok ${(z.klijent?.ime || '').split(' ')[0] || ''}, zadatak „${z.naslov}“ je gotov.`.replace('Bok ,', 'Bok,'), z.minuta ? `Vrijeme izrade: ${trajanje(z.minuta)}.` : '', 'Pogledaj ga i javi ako treba još nešto doraditi.'].filter(Boolean),
        gumb: { tekst: 'Pogledaj zadatak', href: link },
      }),
    };
  } else {
    return json(400, { greska: 'Nepoznata obavijest.' });
  }

  try {
    return json(200, { ok: true, poslano: await posalji(poruka) });
  } catch (e) {
    console.error('[obavijest]', e);
    return json(502, { greska: 'E-mail nije poslan.' });
  }
};
