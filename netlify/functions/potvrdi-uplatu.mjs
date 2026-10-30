// POST /api/potvrdi-uplatu { id }  (samo admin)
// Označi narudžbu plaćenom, otvori ili produlji pristup klijentu i pošalji mu link za prijavu.
import { baza, demo, json, tijelo, prijavljeni, plusMjeseci, isoDatum, hrDatum, SITE } from '../lib/zajednicko.mjs';
import { posalji, predlozak } from '../lib/posta.mjs';
import { PAKETI, MJESECNI } from '../../app/paketi.mjs';

export const config = { path: '/api/potvrdi-uplatu' };

export default async (req) => {
  if (req.method !== 'POST') return json(405, { greska: 'Metoda nije dopuštena.' });
  if (demo()) return json(503, { greska: 'CRM još nije spojen na bazu.' });
  const admin = await prijavljeni(req);
  if (!admin?.is_admin) return json(403, { greska: 'Samo admin može potvrditi uplatu.' });

  const { id } = await tijelo(req);
  const db = baza();
  const { data: n } = await db.from('narudzbe').select('*').eq('id', id).single();
  if (!n) return json(404, { greska: 'Narudžba ne postoji.' });
  if (n.status === 'placeno') return json(409, { greska: 'Ova uplata je već potvrđena.' });

  // pronađi ili otvori korisnički račun
  let { data: profil } = await db.from('profiles').select('*').eq('email', n.email).maybeSingle();
  if (!profil) {
    const { data: novi, error } = await db.auth.admin.createUser({ email: n.email, email_confirm: true });
    if (error) {
      console.error(error);
      return json(500, { greska: 'Račun za klijenta nije otvoren: ' + error.message });
    }
    ({ data: profil } = await db.from('profiles').select('*').eq('id', novi.user.id).single());
  }

  const danas = new Date();
  danas.setHours(0, 0, 0, 0);
  const od = profil.aktivan_do && new Date(profil.aktivan_do) >= danas ? new Date(profil.aktivan_do) : danas;
  const aktivanDo = isoDatum(plusMjeseci(od, n.period === 'godisnje' ? 12 : 1));
  // jednokratni web ne mijenja mjesečni paket koji klijent možda već ima
  const paket = MJESECNI.includes(n.paket) || !profil.paket ? n.paket : profil.paket;

  await db.from('profiles').update({ aktivan_do: aktivanDo, paket, ime: profil.ime || n.ime, tvrtka: profil.tvrtka || n.tvrtka }).eq('id', profil.id);
  await db.from('narudzbe').update({ status: 'placeno', placeno_at: new Date().toISOString(), user_id: profil.id }).eq('id', n.id);

  let poslano = false;
  try {
    const { data: link, error } = await db.auth.admin.generateLink({
      type: 'magiclink', email: n.email, options: { redirectTo: `${SITE()}/app/` },
    });
    if (error) throw error;
    const mail = predlozak({
      naslov: n.novi ? 'Dobro došli u TMBingo' : 'Uplata je stigla',
      odlomci: [
        `Bok ${(profil.ime || n.ime).split(' ')[0]}, uplata ${n.poziv} (${PAKETI[n.paket]?.naziv || 'TMBingo'}) je stigla. Pristup TMBingo prostoru aktivan je do ${hrDatum(aktivanDo)}.`,
        'U TMBingo prostoru dodaješ zadatke, šalješ datoteke i pratiš kako napreduje izrada. Link ispod te odmah prijavljuje i vrijedi jednom, a kasnije se prijavljuješ na tmbingo.com/app upisom e-maila.',
      ],
      gumb: { tekst: 'Otvori TMBingo prostor', href: link.properties.action_link },
    });
    poslano = await posalji({ to: n.email, subject: n.novi ? 'Dobro došli u TMBingo: link za prijavu' : 'TMBingo: uplata je stigla', ...mail });
  } catch (e) {
    console.error('[potvrdi-uplatu] e-mail nije poslan', e);
  }

  return json(200, { ok: true, aktivan_do: aktivanDo, poslano });
};
