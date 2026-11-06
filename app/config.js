/* Supabase postavke za TMBingo CRM (Supabase → Project Settings → API Keys).
   Publishable (anon) ključ je javan po namjeni, podatke štite pravila pristupa u bazi.
   Dok su prazne, CRM radi u demo načinu s izmišljenim podacima. */
window.TMB_CONFIG = {
  supabaseUrl: 'https://edspnavvakpmcrwyjzes.supabase.co',
  supabaseAnonKey: 'sb_publishable_q92I1EkqhvROgAeb7WokoA_PT0zg52M',
  // Cloudflare Turnstile "Site Key" (javan); tajni ključ ide na Netlify kao TURNSTILE_SECRET. Prazno = isključeno.
  turnstileSiteKey: '0x4AAAAAAF2DHpcGtRuJ2wVE',
};
