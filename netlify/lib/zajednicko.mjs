// Zajedničko za Netlify funkcije: Supabase sa servisnim ključem, provjera prijave, odgovori.
import { createClient } from '@supabase/supabase-js';

export const env = (k, d = '') => (process.env[k] ?? d).trim();

// Adresa stranice za linkove u e-mailovima: SITE_URL ako je postavljen, inače adresa s koje je stigao
// zahtjev (glavna stranica ili pregled), da linkovi rade i prije prebacivanja domene.
let zadnjiOrigin = '';
export function zapamtiOrigin(req) {
  try { zadnjiOrigin = new URL(req.url).origin; } catch {}
}
export const SITE = () => (env('SITE_URL') || zadnjiOrigin || 'https://tmbingo.com').replace(/\/$/, '');
export const ADMIN_EMAIL = () => env('ADMIN_EMAIL', 'tmbingo@gmail.com');
// Koliko dana neplaćena narudžba čuva mjesto.
export const ROK_UPLATE_DANA = 3;
export const MAX_KLIJENATA = () => parseInt(env('MAX_KLIJENATA', '10'), 10) || 10;

// Bez Supabase postavki funkcije rade u demo načinu (ništa se ne sprema ni ne šalje).
export const demo = () => !env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY');

let klijent;
export function baza() {
  klijent ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return klijent;
}

// Profil prijavljenog korisnika iz "Authorization: Bearer <token>" ili null.
export async function prijavljeni(req) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || demo()) return null;
  const { data, error } = await baza().auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: profil } = await baza().from('profiles').select('*').eq('id', data.user.id).single();
  return profil || null;
}

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function tijelo(req) {
  try { return await req.json(); } catch { return {}; }
}

const MJESECI = ['siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
export const mjesecNaziv = (d = new Date()) => MJESECI[d.getMonth()] + ' ' + d.getFullYear();
export const pocetakMjeseca = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

// Datum + n mjeseci, bez preskakanja na idući mjesec (31. 1. + 1 = 28. 2.).
export function plusMjeseci(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
  r.setDate(Math.min(d.getDate(), new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()));
  return r;
}
export const isoDatum = (d) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const hrDatum = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-'); return `${+d}. ${+m}. ${y}.`; };

export function trajanje(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

// Koliko je mjesta za nove klijente još slobodno ovaj mjesec.
export async function mjesta() {
  if (demo()) return { slobodno: MAX_KLIJENATA(), max: MAX_KLIJENATA() };
  const db = baza();
  const pocetak = pocetakMjeseca();
  // Pro paket zauzima dva mjesta, zato se zbrajaju mjesta, a ne narudžbe
  const [{ data }, { data: post }] = await Promise.all([
    // neplaćena narudžba drži mjesto samo ROK_UPLATE_DANA dana, da lažne narudžbe ne "rasprodaju" mjesec
    db.from('narudzbe').select('mjesta').eq('novi', true).neq('status', 'otkazano').gte('created_at', pocetak.toISOString())
      .or(`status.eq.placeno,created_at.gte."${new Date(Date.now() - ROK_UPLATE_DANA * 864e5).toISOString()}"`),
    db.from('postavke').select('*').eq('id', 1).maybeSingle(),
  ]);
  const max = post ? post.mjesta_max : MAX_KLIJENATA();
  // ručno zauzeta mjesta (klijenti izvan CRM-a) vrijede samo za mjesec u kojem su upisana
  const rucno = post && post.zauzeto_mjesec === isoDatum(pocetak) ? post.zauzeto_rucno : 0;
  const zauzeto = (data || []).reduce((s, n) => s + (n.mjesta || 1), 0) + rucno;
  return { slobodno: Math.max(0, Math.min(max, max - zauzeto)), max };
}
export async function slobodnaMjesta() {
  return (await mjesta()).slobodno;
}

// ---------------------------------------------------------------------------
// Zaštita javnih formi i chata
// ---------------------------------------------------------------------------

// IP posjetitelja (Netlify ga postavlja u x-nf-client-connection-ip).
export const ipAdresa = (req) =>
  (req.headers.get('x-nf-client-connection-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'nepoznato').trim();

// Ograničenje broja zahtjeva, pamti se u bazi pa vrijedi za sve instance funkcije.
// pravila: [[kljuc, max, sekundi], ...]. Vraća true ako je sve u granicama.
// Ako baza nije dostupna, propušta (radije jedan bot više nego odbijen kupac).
export async function uGranicama(pravila) {
  if (demo()) return true;
  for (const [kljuc, max, sekundi] of pravila) {
    const { data, error } = await baza().rpc('ogranici', { p_kljuc: kljuc, p_max: max, p_sekundi: sekundi });
    if (error) { console.error('[ogranici]', error.message); return true; }
    if (data === false) return false;
  }
  return true;
}

// Cloudflare Turnstile (nevidljiva provjera da nije bot). Uključuje se postavljanjem TURNSTILE_SECRET na
// Netlifyju i turnstileSiteKey u app/config.js. Dok nije postavljen, provjera se preskače.
export async function nijeBot(token, req) {
  const tajna = env('TURNSTILE_SECRET');
  if (!tajna) return true;
  if (!token) return false;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: tajna, response: String(token), remoteip: ipAdresa(req) }),
    });
    return (await r.json()).success === true;
  } catch (e) {
    console.error('[turnstile]', e);
    return true;
  }
}

// Ime za pozdrav u e-mailu: samo ako izgleda kao ime, da forma ne bi slala tuđi tekst ili linkove.
export const pozdrav = (ime) => {
  const prvo = String(ime || '').trim().split(/\s+/)[0] || '';
  return /^[\p{L}][\p{L}'’-]{1,29}$/u.test(prvo) ? `Bok ${prvo}` : 'Bok';
};

// Ime i prezime: barem dvije riječi sa slovima (botovi šalju jedan niz nasumičnih slova).
export const imeIPrezime = (ime) => /^[\p{L}][\p{L}.'’-]*(\s+[\p{L}][\p{L}.'’-]*)+$/u.test(String(ime || '').trim());

// Kontrolna znamenka OIB-a (ISO 7064, MOD 11,10).
export function ispravanOib(oib) {
  if (!/^\d{11}$/.test(oib)) return false;
  let a = 10;
  for (let i = 0; i < 10; i++) {
    a = (a + +oib[i]) % 10 || 10;
    a = (a * 2) % 11;
  }
  return (11 - a) % 10 === +oib[10];
}
