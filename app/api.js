/* Podatkovni sloj za TMBingo CRM: pravi (Supabase) i demo (u memoriji preglednika, za pregled bez baze). */
(function () {
  var MAX = 10 * 1024 * 1024;
  var cfg = window.TMB_CONFIG || {};

  function safeName(n) {
    return String(n).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(-120) || 'datoteka';
  }

  async function postApi(path, body, token) {
    var r = await fetch(path, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, token ? { authorization: 'Bearer ' + token } : {}),
      body: JSON.stringify(body || {}),
    });
    var d = {};
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(d.greska || 'Nešto nije u redu (' + r.status + ').');
    return d;
  }

  /* ------------------------------------------------------------------ pravi */
  function real() {
    var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    });
    var me = null;
    var KLIJENT = 'klijent:profiles!zadaci_klijent_id_fkey(id,email,ime,tvrtka)';

    async function token() { var s = (await sb.auth.getSession()).data.session; return s && s.access_token; }
    function check(res) { if (res.error) throw new Error(res.error.message); return res.data; }
    async function notify(body) { try { await postApi('/api/obavijest', body, await token()); } catch (e) { console.warn(e); } }

    async function upload(klijentId, zadatakId, porukaId, files, links) {
      for (var f of files || []) {
        if (f.size > MAX) throw new Error('Datoteka ' + f.name + ' je veća od 10 MB.');
        var path = klijentId + '/' + zadatakId + '/' + Date.now() + '-' + safeName(f.name);
        check(await sb.storage.from('prilozi').upload(path, f, { contentType: f.type || undefined, upsert: false }));
        check(await sb.from('prilozi').insert({ zadatak_id: zadatakId, poruka_id: porukaId, vrsta: 'datoteka', naziv: f.name.slice(0, 300), putanja: path, velicina: f.size }));
      }
      for (var l of links || []) {
        check(await sb.from('prilozi').insert({ zadatak_id: zadatakId, poruka_id: porukaId, vrsta: 'link', naziv: l.replace(/^https:\/\//, '').slice(0, 300), url: l }));
      }
    }

    return {
      demo: false,
      onAuth: function (cb) { sb.auth.onAuthStateChange(function (ev, s) { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') cb(ev, s && s.user ? s.user.id : null); }); },
      session: async function () {
        var s = (await sb.auth.getSession()).data.session;
        if (!s) return (me = null);
        me = check(await sb.from('profiles').select('*').eq('id', s.user.id).single());
        return me;
      },
      login: async function (email) {
        var res = await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + '/app/' } });
        if (res.error) {
          if (/signups not allowed|not found|otp_disabled/i.test(res.error.message)) throw new Error('Za ovu adresu nemamo aktivan paket. Provjeri adresu ili uzmi TMBingo paket.');
          if (/rate|seconds/i.test(res.error.message)) throw new Error('Link je upravo poslan. Pričekaj minutu pa pokušaj ponovno.');
          throw new Error(res.error.message);
        }
      },
      logout: function () { return sb.auth.signOut(); },
      updateProfile: async function (p) { check(await sb.from('profiles').update(p).eq('id', me.id)); Object.assign(me, p); },
      listTasks: async function () {
        return check(await sb.from('zadaci').select('*, ' + KLIJENT).order('created_at', { ascending: false }));
      },
      getTask: async function (id) {
        var z = check(await sb.from('zadaci').select('*, ' + KLIJENT).eq('id', id).maybeSingle());
        if (!z) return null;
        z.poruke = check(await sb.from('poruke').select('*, autor:profiles(id,ime,email,is_admin)').eq('zadatak_id', id).order('created_at'));
        z.prilozi = check(await sb.from('prilozi').select('*').eq('zadatak_id', id).order('created_at'));
        return z;
      },
      createTask: async function (d) {
        var z = check(await sb.from('zadaci').insert({ naslov: d.naslov, opis: d.opis }).select('*').single());
        await upload(me.id, z.id, null, d.files, d.links);
        notify({ vrsta: 'zadatak', zadatak_id: z.id });
        return z;
      },
      addMessage: async function (z, d) {
        var p = check(await sb.from('poruke').insert({ zadatak_id: z.id, tekst: d.tekst }).select('*').single());
        await upload(z.klijent_id, z.id, p.id, d.files, d.links);
        notify({ vrsta: 'poruka', zadatak_id: z.id, poruka_id: p.id });
        return p;
      },
      setStatus: async function (z, status) {
        var r = check(await sb.from('zadaci').update({ status: status }).eq('id', z.id).select('*').single());
        if (status === 'zavrseno') notify({ vrsta: 'zavrseno', zadatak_id: z.id });
        return r;
      },
      setMinutes: async function (z, min) { return check(await sb.from('zadaci').update({ minuta: min }).eq('id', z.id).select('*').single()); },
      fileUrl: async function (putanja) { return check(await sb.storage.from('prilozi').createSignedUrl(putanja, 3600)).signedUrl; },
      listOrders: async function () { return check(await sb.from('narudzbe').select('*').order('created_at', { ascending: false }).limit(300)); },
      confirmOrder: async function (id) { return postApi('/api/potvrdi-uplatu', { id: id }, await token()); },
      cancelOrder: async function (id) { check(await sb.from('narudzbe').update({ status: 'otkazano' }).eq('id', id)); },
      listClients: async function () { return check(await sb.from('profiles').select('*').eq('is_admin', false).order('created_at', { ascending: false })); },
      renew: async function (izbor) { return postApi('/api/narudzba', izbor || {}, await token()); },
    };
  }

  /* ------------------------------------------------------------------ demo */
  function demo() {
    var now = Date.now(), H = 3600e3, D = 24 * H;
    var iso = function (t) { return new Date(t).toISOString(); };
    var inDays = function (n) { var d = new Date(now + n * D); return d.toISOString().slice(0, 10); };
    var admin = { id: 'a', email: 'tmbingo@gmail.com', ime: 'Tonći', tvrtka: 'TMBingo', is_admin: true };
    var ana = { id: 'k1', email: 'ana@kavana-zadar.hr', ime: 'Ana Kovač', tvrtka: 'Kavana Forum', is_admin: false, paket: 'tmbingo', aktivan_do: inDays(19), created_at: iso(now - 40 * D) };
    var ivan = { id: 'k2', email: 'ivan@apartmani-bibinje.hr', ime: 'Ivan Perić', tvrtka: 'Apartmani Perić', is_admin: false, paket: 'start', aktivan_do: inDays(-3), created_at: iso(now - 70 * D) };
    var profiles = [admin, ana, ivan];
    var role = 'klijent';
    try { role = sessionStorage.getItem('tmb-demo-uloga') || 'klijent'; } catch (e) {}
    var loggedIn = true;
    var id = 100;
    var zadaci = [
      { id: 14, klijent_id: 'k1', naslov: 'Jesenski meni za Instagram', opis: 'Trebamo 4 objave za novi jesenski meni. Fotke šaljem u privitku, tekst neka bude kratak i topao.', status: 'u_izradi', minuta: 85, created_at: iso(now - 2 * D), prihvaceno_at: iso(now - 2 * D + 2 * H), u_izradi_at: iso(now - D) },
      { id: 12, klijent_id: 'k1', naslov: 'Nova naslovna fotografija na webu', opis: 'Zamijeniti hero sliku na webu novom fotkom terase.', status: 'zavrseno', minuta: 40, created_at: iso(now - 9 * D), prihvaceno_at: iso(now - 9 * D + H), u_izradi_at: iso(now - 8 * D), zavrseno_at: iso(now - 7 * D) },
      { id: 9, klijent_id: 'k1', naslov: 'Jelovnik za tisak A4', opis: 'Dvostrani jelovnik, isti stil kao web.', status: 'zavrseno', minuta: 150, created_at: iso(now - 20 * D), prihvaceno_at: iso(now - 20 * D + H), u_izradi_at: iso(now - 19 * D), zavrseno_at: iso(now - 16 * D) },
      { id: 15, klijent_id: 'k1', naslov: 'Plakat za Halloween party', opis: 'Plakat B2 i verzija za story. Datum 31. 10., DJ Marin.', status: 'novo', minuta: 0, created_at: iso(now - 3 * H) },
      { id: 13, klijent_id: 'k2', naslov: 'Cjenik za sezonu 2027', opis: 'Ažurirati cjenik na webu.', status: 'prihvaceno', minuta: 0, created_at: iso(now - 5 * D), prihvaceno_at: iso(now - 4 * D) },
    ];
    var poruke = [
      { id: 1, zadatak_id: 14, autor_id: 'a', tekst: 'Bok Ana! Prve dvije objave su u Figmi: https://figma.com/proto/primjer\nJavi što misliš o bojama.', created_at: iso(now - 20 * H) },
      { id: 2, zadatak_id: 14, autor_id: 'k1', tekst: 'Super su! Može li malo veći naslov na drugoj?', created_at: iso(now - 18 * H) },
      { id: 3, zadatak_id: 12, autor_id: 'a', tekst: 'Nova fotografija je postavljena. Pogledaj na webu.', created_at: iso(now - 7 * D) },
    ];
    var prilozi = [
      { id: 1, zadatak_id: 14, poruka_id: null, vrsta: 'datoteka', naziv: 'meni-fotke.zip', velicina: 8.2 * 1024 * 1024, putanja: 'demo' },
      { id: 2, zadatak_id: 14, poruka_id: null, vrsta: 'link', naziv: 'we.tl/t-primjer', url: 'https://we.tl/t-primjer' },
      { id: 3, zadatak_id: 14, poruka_id: 1, vrsta: 'datoteka', naziv: 'objave-v1.pdf', velicina: 2.4 * 1024 * 1024, putanja: 'demo' },
    ];
    var narudzbe = [
      { id: 3, poziv: '2026-3', email: 'marija@frizerski-studio.hr', ime: 'Marija Jurić', tvrtka: 'Frizerski studio M', status: 'ceka_uplatu', novi: true, paket: 'pro', period: 'mjesecno', iznos_centi: 74900, created_at: iso(now - 5 * H) },
      { id: 2, poziv: '2026-2', email: ana.email, ime: ana.ime, tvrtka: ana.tvrtka, status: 'placeno', novi: false, paket: 'tmbingo', period: 'mjesecno', iznos_centi: 39900, created_at: iso(now - 11 * D), placeno_at: iso(now - 10 * D) },
      { id: 1, poziv: '2026-1', email: ivan.email, ime: ivan.ime, tvrtka: ivan.tvrtka, status: 'placeno', novi: true, paket: 'start', period: 'godisnje', iznos_centi: 199000, created_at: iso(now - 33 * D), placeno_at: iso(now - 33 * D) },
    ];
    var blobs = {};
    var me = function () { return role === 'admin' ? admin : ana; };
    var prof = function (pid) { return profiles.find(function (p) { return p.id === pid; }); };
    var vis = function () { return zadaci.filter(function (z) { return me().is_admin || z.klijent_id === me().id; }); };
    var withK = function (z) { var k = prof(z.klijent_id); return Object.assign({}, z, { klijent: { id: k.id, email: k.email, ime: k.ime, tvrtka: k.tvrtka } }); };
    var wait = function (v) { return new Promise(function (r) { setTimeout(function () { r(v); }, 120); }); };
    function addFiles(z, pid, files, links) {
      (files || []).forEach(function (f) {
        if (f.size > MAX) throw new Error('Datoteka ' + f.name + ' je veća od 10 MB.');
        var key = 'b' + (++id); blobs[key] = URL.createObjectURL(f);
        prilozi.push({ id: ++id, zadatak_id: z.id, poruka_id: pid, vrsta: 'datoteka', naziv: f.name, velicina: f.size, putanja: key });
      });
      (links || []).forEach(function (l) { prilozi.push({ id: ++id, zadatak_id: z.id, poruka_id: pid, vrsta: 'link', naziv: l.replace(/^https:\/\//, ''), url: l }); });
    }
    function stamp(z, status) {
      var t = iso(Date.now());
      if (status === 'prihvaceno') z.prihvaceno_at = z.prihvaceno_at || t;
      if (status === 'u_izradi') { z.prihvaceno_at = z.prihvaceno_at || t; z.u_izradi_at = z.u_izradi_at || t; }
      if (status === 'zavrseno') { z.prihvaceno_at = z.prihvaceno_at || t; z.zavrseno_at = t; } else z.zavrseno_at = null;
      z.status = status;
    }

    return {
      demo: true,
      role: function () { return role; },
      setRole: function (r) { role = r; try { sessionStorage.setItem('tmb-demo-uloga', r); } catch (e) {} },
      onAuth: function () {},
      session: function () { return wait(loggedIn ? me() : null); },
      login: function () { loggedIn = true; return wait(); },
      logout: function () { loggedIn = false; return wait(); },
      updateProfile: function (p) { Object.assign(me(), p); return wait(); },
      listTasks: function () { return wait(vis().map(withK).sort(function (a, b) { return b.created_at < a.created_at ? -1 : 1; })); },
      getTask: function (tid) {
        var z = vis().find(function (x) { return x.id === +tid; });
        if (!z) return wait(null);
        var r = withK(z);
        r.poruke = poruke.filter(function (p) { return p.zadatak_id === z.id; }).map(function (p) { var a = prof(p.autor_id); return Object.assign({}, p, { autor: me().is_admin || a.id === me().id ? a : null }); });
        r.prilozi = prilozi.filter(function (p) { return p.zadatak_id === z.id; });
        return wait(r);
      },
      createTask: function (d) {
        if (!(me().aktivan_do >= new Date().toISOString().slice(0, 10))) return Promise.reject(new Error('Paket nije aktivan.'));
        var z = { id: ++id, klijent_id: me().id, naslov: d.naslov, opis: d.opis, status: 'novo', minuta: 0, created_at: iso(Date.now()) };
        zadaci.push(z); addFiles(z, null, d.files, d.links); return wait(z);
      },
      addMessage: function (z, d) { var p = { id: ++id, zadatak_id: z.id, autor_id: me().id, tekst: d.tekst, created_at: iso(Date.now()) }; poruke.push(p); addFiles(z, p.id, d.files, d.links); return wait(p); },
      setStatus: function (z, s) { var t = zadaci.find(function (x) { return x.id === z.id; }); stamp(t, s); return wait(t); },
      setMinutes: function (z, m) { var t = zadaci.find(function (x) { return x.id === z.id; }); t.minuta = m; return wait(t); },
      fileUrl: function (p) { return wait(blobs[p] || 'data:text/plain,Ovo%20je%20demo%20datoteka.'); },
      listOrders: function () { return wait(narudzbe.slice()); },
      confirmOrder: function (oid) {
        var n = narudzbe.find(function (x) { return x.id === oid; }); n.status = 'placeno'; n.placeno_at = iso(Date.now());
        if (!profiles.find(function (p) { return p.email === n.email; })) profiles.push({ id: 'k' + (++id), email: n.email, ime: n.ime, tvrtka: n.tvrtka, is_admin: false, aktivan_do: inDays(30), created_at: iso(Date.now()) });
        return wait({ ok: true, poslano: false, demo: true });
      },
      cancelOrder: function (oid) { narudzbe.find(function (x) { return x.id === oid; }).status = 'otkazano'; return wait(); },
      listClients: function () { return wait(profiles.filter(function (p) { return !p.is_admin; })); },
      renew: async function (izbor) {
        try { return await postApi('/api/narudzba', Object.assign({ ime: me().ime, email: me().email, tvrtka: me().tvrtka, uvjeti: true }, izbor)); }
        catch (e) { return { demo: true, uplata: { iznos: '399,00 €', iban: 'HR1210010051863000160', model: 'HR00', poziv: 'DEMO-1', opis: 'TMBingo paket', primatelj: { ime: 'Studio23k, vl. Tonći Morić', adresa: 'Jakova Gotovca 18', mjesto: '23000 Zadar' }, primjer: true } }; }
      },
    };
  }

  window.TMB_MAX = MAX;
  window.TMB_API = cfg.supabaseUrl && cfg.supabaseAnonKey && !/[?&]demo\b/.test(location.search) ? real() : demo();
})();
