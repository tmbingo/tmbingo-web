// Zajedničko za Netlify funkcije: Supabase sa servisnim ključem, provjera prijave, odgovori.
import { createClient } from '@supabase/supabase-js';

export const env = (k, d = '') => (process.env[k] ?? d).trim();

export const SITE = () => env('SITE_URL', 'https://tmbingo.com').replace(/\/$/, '');
export const ADMIN_EMAIL = () => env('ADMIN_EMAIL', 'tmbingo@gmail.com');
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
export async function slobodnaMjesta() {
  if (demo()) return MAX_KLIJENATA();
  // Pro paket zauzima dva mjesta, zato se zbrajaju mjesta, a ne narudžbe
  const { data } = await baza()
    .from('narudzbe')
    .select('mjesta')
    .eq('novi', true)
    .neq('status', 'otkazano')
    .gte('created_at', pocetakMjeseca().toISOString());
  const zauzeto = (data || []).reduce((s, n) => s + (n.mjesta || 1), 0);
  return Math.max(0, MAX_KLIJENATA() - zauzeto);
}
