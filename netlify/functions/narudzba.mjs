// GET  /api/narudzba  → koliko je mjesta slobodno ovaj mjesec
// POST /api/narudzba  → nova narudžba paketa (ili produljenje za prijavljenog klijenta) i podaci za uplatu
import {
  baza, demo, json, tijelo, prijavljeni, slobodnaMjesta, mjesecNaziv, MAX_KLIJENATA, ADMIN_EMAIL, SITE,
} from '../lib/zajednicko.mjs';
import { PAKETI, cijena } from '../../app/paketi.mjs';
import { podaciZaUplatu, png } from '../lib/uplatnica.mjs';
import { posalji, predlozak, esc } from '../lib/posta.mjs';

export const config = { path: '/api/narudzba' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cist = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async (req) => {
  if (req.method === 'GET') {
    return json(200, { slobodno: await slobodnaMjesta(), max: MAX_KLIJENATA(), mjesec: mjesecNaziv(), demo: demo() });
  }
  if (req.method !== 'POST') return json(405, { greska: 'Metoda nije dopuštena.' });

  const b = await tijelo(req);
  if (b.web) return json(200, { ok: true }); // zamka za botove

  const profil = await prijavljeni(req);
  const podaci = profil
    ? { email: profil.email, ime: profil.ime || cist(b.ime, 100) || profil.email, tvrtka: profil.tvrtka || cist(b.tvrtka, 120) }
    : { email: cist(b.email, 200).toLowerCase(), ime: cist(b.ime, 100), tvrtka: cist(b.tvrtka, 120) };
  Object.assign(podaci, {
    oib: cist(b.oib, 20).replace(/\D/g, ''),
    adresa: cist(b.adresa, 120),
    mjesto: cist(b.mjesto, 80),
    napomena: String(b.napomena ?? '').trim().slice(0, 2000),
  });

  if (!profil) {
    if (podaci.ime.length < 2) return json(400, { greska: 'Upiši ime i prezime.' });
    if (!EMAIL.test(podaci.email)) return json(400, { greska: 'Upiši ispravnu e-mail adresu.' });
    if (b.uvjeti !== true) return json(400, { greska: 'Za narudžbu treba prihvatiti uvjete poslovanja.' });
  }
  if (podaci.oib && podaci.oib.length !== 11) return json(400, { greska: 'OIB ima 11 znamenki.' });

  const paket = PAKETI[b.paket] ? b.paket : 'tmbingo';
  const p = PAKETI[paket];
  const period = p.jednokratno ? 'jednokratno' : b.period === 'godisnje' ? 'godisnje' : 'mjesecno';
  const centi = cijena(paket, period);
  const mjesec = mjesecNaziv();
  const opis = period === 'mjesecno' ? `${p.uplata} ${mjesec}` : period === 'godisnje' ? `${p.uplata} godisnje` : p.uplata;
  const naziv = `${p.naziv}${period === 'godisnje' ? ', godišnje' : period === 'mjesecno' ? ', mjesečno' : ''}`;

  if (demo()) {
    const u = podaciZaUplatu({ centi, platitelj: podaci, poziv: 'DEMO-1', opis });
    delete u._tekst;
    return json(200, { ok: true, demo: true, naziv, uplata: u });
  }

  const db = baza();
  // novi klijent = još nema nijednu plaćenu narudžbu
  const { count: placenih } = await db.from('narudzbe').select('id', { count: 'exact', head: true })
    .eq('email', podaci.email).eq('status', 'placeno');
  const novi = !profil && !placenih;
  if (novi && (await slobodnaMjesta()) < p.mjesta) {
    return json(409, { greska: `Za ${mjesec} su sva mjesta popunjena. Javi nam se na info@tmbingo.com i stavit ćemo te na listu za idući mjesec.`, puno: true });
  }

  const { data: n, error } = await db.from('narudzbe')
    .insert({ ...podaci, user_id: profil?.id ?? null, novi, paket, period, mjesta: p.mjesta, iznos_centi: centi })
    .select('*').single();
  if (error) {
    console.error(error);
    return json(500, { greska: 'Narudžbu trenutno ne možemo spremiti. Pokušaj ponovno za minutu.' });
  }

  const u = podaciZaUplatu({ centi, platitelj: podaci, poziv: n.poziv, opis });
  const tekst = u._tekst;
  delete u._tekst;

  try {
    const prilozi = [{ filename: 'qr-uplata.png', content: await png('qr', tekst.epc), cid: 'qr' }];
    if (u.hub3Svg) prilozi.push({ filename: 'barkod-uplata.png', content: await png('hub3', tekst.hub3), cid: 'hub3' });
    const tablica = `<table style="font:15px/1.6 Helvetica,Arial,sans-serif;border-collapse:collapse;margin:8px 0 18px">${[
      ['Iznos', u.iznos], ['Primatelj', `${u.primatelj.ime}, ${u.primatelj.adresa}, ${u.primatelj.mjesto}`],
      ['IBAN', u.iban], ['Model i poziv na broj', `${u.model} ${u.poziv}`], ['Opis', u.opis],
    ].map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#8a8a8a;vertical-align:top">${k}</td><td style="padding:2px 0"><b>${esc(v)}</b></td></tr>`).join('')}</table>`;
    const kodovi = (u.hub3Svg ? '<p style="margin:0 0 6px;font:13px Helvetica,Arial,sans-serif;color:#8a8a8a">Barkod za hrvatske banke</p><img src="cid:hub3" alt="HUB3 barkod" style="display:block;max-width:100%;margin:0 0 18px">' : '')
      + '<p style="margin:0 0 6px;font:13px Helvetica,Arial,sans-serif;color:#8a8a8a">QR kod za Revolut i europske banke</p><img src="cid:qr" alt="QR kod" width="180" height="180" style="display:block">';
    const mail = predlozak({
      naslov: 'Hvala na narudžbi',
      odlomci: [
        `Bok ${podaci.ime.split(' ')[0]}, zaprimili smo narudžbu: ${naziv}.`,
        'Uplatu možeš skenirati barkodom ili QR kodom u aplikaciji banke, ili je upisati ručno:',
        { html: tablica, text: `Iznos: ${u.iznos}\nIBAN: ${u.iban}\nPoziv na broj: ${u.model} ${u.poziv}\nOpis: ${u.opis}` },
        u.revolut ? { html: `Možeš platiti i karticom preko Revoluta: <a href="${esc(u.revolut)}">${esc(u.revolut)}</a>`, text: `Plaćanje karticom: ${u.revolut}` } : '',
        'Čim uplata stigne, na ovaj e-mail šaljemo link za prijavu u TMBingo prostor, gdje dodaješ zadatke i pratiš njihovu izradu.',
      ].filter(Boolean),
      dodatak: kodovi,
    });
    await posalji({ to: podaci.email, subject: `TMBingo: podaci za uplatu (${n.poziv})`, ...mail, attachments: prilozi });
    const zaAdmina = predlozak({
      naslov: `Nova narudžba ${n.poziv}`,
      odlomci: [
        `${naziv}: ${u.iznos}`,
        `${podaci.ime}${podaci.tvrtka ? ', ' + podaci.tvrtka : ''} (${podaci.email})`,
        novi ? 'Novi klijent.' : 'Produljenje postojećeg klijenta.',
        podaci.napomena ? 'Napomena: ' + podaci.napomena : '',
        'Kad uplata stigne, potvrdi je u adminu.',
      ].filter(Boolean),
      gumb: { tekst: 'Otvori admin', href: `${SITE()}/app/#/narudzbe` },
    });
    await posalji({ to: ADMIN_EMAIL(), subject: `Nova narudžba ${n.poziv}: ${podaci.ime}`, ...zaAdmina, replyTo: podaci.email });
  } catch (e) {
    console.error('[narudzba] e-mail nije poslan', e);
  }

  return json(200, { ok: true, naziv, uplata: u });
};
