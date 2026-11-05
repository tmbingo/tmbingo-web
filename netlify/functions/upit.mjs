// POST /api/upit → upit za uslugu van paketa (/usluga/). Ne sprema se u bazu, nego stiže e-mailom na ADMIN_EMAIL,
// a klijent dobiva potvrdu da je upit zaprimljen.
import { json, tijelo, ADMIN_EMAIL, zapamtiOrigin } from '../lib/zajednicko.mjs';
import { USLUGE } from '../../app/usluge.mjs';
import { posalji, predlozak } from '../lib/posta.mjs';

export const config = { path: '/api/upit' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cist = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async (req) => {
  zapamtiOrigin(req);
  if (req.method !== 'POST') return json(405, { greska: 'Metoda nije dopuštena.' });

  const b = await tijelo(req);
  if (b.web) return json(200, { ok: true }); // zamka za botove

  const kljuc = USLUGE[b.usluga] ? b.usluga : null;
  const d = {
    ime: cist(b.ime, 100),
    email: cist(b.email, 200).toLowerCase(),
    tvrtka: cist(b.tvrtka, 120),
    telefon: cist(b.telefon, 40),
    rok: cist(b.rok, 120),
    opis: String(b.opis ?? '').trim().slice(0, 4000),
  };
  if (!kljuc) return json(400, { greska: 'Odaberi uslugu.' });
  if (d.ime.length < 2) return json(400, { greska: 'Upiši ime i prezime.' });
  if (!EMAIL.test(d.email)) return json(400, { greska: 'Upiši ispravnu e-mail adresu.' });
  if (d.opis.length < 10) return json(400, { greska: 'Opiši ukratko što trebaš.' });
  if (b.privatnost !== true) return json(400, { greska: 'Za slanje upita treba prihvatiti pravila privatnosti.' });

  const u = USLUGE[kljuc];
  const naziv = `${u.naziv} (${u.cijena}, ${u.jedinica})`;

  try {
    const zaAdmina = predlozak({
      naslov: `Novi upit: ${u.naziv}`,
      odlomci: [
        naziv,
        `${d.ime}${d.tvrtka ? ', ' + d.tvrtka : ''} (${d.email}${d.telefon ? ', ' + d.telefon : ''})`,
        d.rok ? 'Željeni rok: ' + d.rok : '',
        'Zahtjevi:\n' + d.opis,
        'Odgovori izravno na ovaj e-mail i stiže klijentu.',
      ].filter(Boolean),
    });
    const poslano = await posalji({ to: ADMIN_EMAIL(), subject: `Upit: ${u.naziv}, ${d.ime}`, ...zaAdmina, replyTo: d.email });
    if (!poslano) throw new Error('SMTP nije postavljen');
  } catch (e) {
    console.error('[upit] e-mail nije poslan', e);
    return json(500, { greska: 'Upit trenutno ne možemo poslati. Pošalji ga na info@tmbingo.com.' });
  }

  try {
    const zaKlijenta = predlozak({
      naslov: 'Upit je zaprimljen',
      odlomci: [
        `Bok ${d.ime.split(' ')[0]}, hvala na upitu za: ${naziv}.`,
        'Pregledat ćemo zahtjeve i javiti se s ponudom i rokom, najkasnije idući radni dan.',
        'Ono što si nam poslao ili poslala:\n' + d.opis,
      ],
    });
    await posalji({ to: d.email, subject: `TMBingo: upit za ${u.naziv.toLowerCase()} je zaprimljen`, ...zaKlijenta });
  } catch (e) {
    console.error('[upit] potvrda klijentu nije poslana', e);
  }

  return json(200, { ok: true, naziv });
};
