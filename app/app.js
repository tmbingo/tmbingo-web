/* TMBingo CRM: prijava, zadaci, poruke, datoteke, a za admina i narudžbe i klijenti. */
(function () {
  var api = window.TMB_API, MAX = window.TMB_MAX;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var app = $('#app'), bar = $('#bar');
  var me = null, timer = null, filter = 'otvoreni';

  var STATUS = { novo: 'Novo', prihvaceno: 'Prihvaćeno', u_izradi: 'U izradi', zavrseno: 'Završeno' };
  var PAKET = { start: 'Start', tmbingo: 'TMBingo paket', pro: 'Pro', web: 'Web za 14 dana' };
  function nazivPaketa(k) { return PAKET[k] || 'Paket'; }
  var NARUDZBA = { ceka_uplatu: 'Čeka uplatu', placeno: 'Plaćeno', otkazano: 'Otkazano' };

  /* ---------- pomoćne ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function linkify(s) {
    return esc(s).replace(/https:\/\/[^\s<]+[^\s<.,;:!?)\]]/g, function (u) { return '<a href="' + u + '" target="_blank" rel="noopener noreferrer">' + u + '</a>'; });
  }
  function datum(t, sat) {
    if (!t) return '';
    var d = new Date(t), s = d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear() + '.';
    return sat ? s + ' u ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : s;
  }
  function trajanje(min) {
    min = min || 0;
    var h = Math.floor(min / 60), m = min % 60;
    return h ? (m ? h + ' h ' + m + ' min' : h + ' h') : m + ' min';
  }
  function velicina(b) { return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' kB'; }
  function st(s, map) { return '<span class="st ' + s + '">' + esc((map || STATUS)[s] || s) + '</span>'; }
  function toast(t) {
    var el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = t;
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 3200);
  }
  function aktivan(p) { return p && p.aktivan_do && p.aktivan_do >= new Date().toISOString().slice(0, 10); }
  function dan(s) { var p = String(s).split('-'); return +p[2] + '. ' + +p[1] + '. ' + p[0] + '.'; }
  function busy(btn, on, txt) {
    if (!btn) return;
    if (on) { btn.dataset.t = btn.textContent; btn.textContent = txt || 'Šaljem…'; btn.disabled = true; }
    else { btn.textContent = btn.dataset.t || btn.textContent; btn.disabled = false; }
  }
  function ime(p) { return (p && (p.ime || p.email)) || ''; }

  /* ---------- traka ---------- */
  function renderBar(route) {
    if (!me) { bar.innerHTML = '<div class="wrap in"><a class="logo" href="/"><img src="/assets/logo-light.png" alt="TMBingo" width="63" height="20"></a></div>'; return; }
    var links = [['#/', 'Zadaci', /^(zadatak|novi|)$/]];
    if (me.is_admin) links.push(['#/narudzbe', 'Narudžbe', /^narudzbe$/], ['#/klijenti', 'Klijenti', /^klijenti$/]);
    else links.push(['#/paket', 'Paket', /^paket$/]);
    bar.innerHTML = '<div class="wrap in"><a class="logo" href="#/"><img src="/assets/logo-light.png" alt="TMBingo" width="63" height="20"></a>' +
      '<nav class="lbl" aria-label="Izbornik">' + links.map(function (l) { return '<a href="' + l[0] + '"' + (l[2].test(route) ? ' class="on" aria-current="page"' : '') + '>' + l[1] + '</a>'; }).join('') + '</nav>' +
      '<div class="me lbl"><span title="' + esc(me.email) + '">' + esc(me.email) + '</span><button type="button" id="logout">Odjava</button></div></div>';
    $('#logout').onclick = async function () { await api.logout(); me = null; location.hash = '#/'; route_(); };
  }

  function renderDemo() {
    var el = $('#demo');
    if (!api.demo) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div class="wrap in lbl"><span>Demo, podaci nisu stvarni</span><span>Gledaš kao:</span>' +
      '<button type="button" data-r="klijent"' + (api.role() === 'klijent' ? ' class="on"' : '') + '>Klijent</button>' +
      '<button type="button" data-r="admin"' + (api.role() === 'admin' ? ' class="on"' : '') + '>Admin</button></div>';
    $$('button', el).forEach(function (b) { b.onclick = function () { api.setRole(b.dataset.r); renderDemo(); start(); }; });
  }

  /* ---------- prijava ---------- */
  function viewLogin() {
    app.className = 'wrap login';
    app.innerHTML = '<div><p class="lbl dim" style="margin-bottom:16px">TMBingo CRM</p><h1>Prijava</h1>' +
      '<form class="form" id="f" novalidate><p>Upiši e-mail s kojim si uzeo ili uzela paket. Poslat ćemo ti link za prijavu, bez lozinke.</p>' +
      '<label class="field"><span class="lbl">E-mail</span><input class="input" type="email" name="email" autocomplete="email" required inputmode="email"></label>' +
      '<p class="err" id="e" hidden></p><div><button class="btn" type="submit">Pošalji link za prijavu</button></div>' +
      '<p class="hint">Nemaš paket? <a href="/paket/">Uzmi TMBingo paket</a>.</p></form></div>';
    $('#f').onsubmit = async function (ev) {
      ev.preventDefault();
      var email = this.email.value.trim().toLowerCase(), e = $('#e'), b = $('button', this);
      e.hidden = true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { e.textContent = 'Upiši ispravnu e-mail adresu.'; e.hidden = false; return; }
      busy(b, true);
      try {
        await api.login(email);
        if (api.demo) return start();
        this.innerHTML = '<p class="ok lbl">Link je poslan</p><p>Otvori e-mail na <b>' + esc(email) + '</b> i klikni na link za prijavu. Ako ga ne vidiš za minutu, provjeri neželjenu poštu.</p>';
      } catch (err) { e.textContent = err.message; e.hidden = false; busy(b, false); }
    };
  }

  /* ---------- popis zadataka ---------- */
  function stats(list) {
    var done = list.filter(function (z) { return z.status === 'zavrseno'; });
    var min = list.reduce(function (s, z) { return s + (z.minuta || 0); }, 0);
    var open = list.length - done.length;
    var avg = done.length ? Math.round(done.reduce(function (s, z) { return s + (z.minuta || 0); }, 0) / done.length) : 0;
    var t = trajanje(min).replace(/(\d+) (h|min)/g, '$1<small>$2</small>');
    return '<div class="stats">' +
      '<div class="stat"><span class="lbl dim">Završeno zadataka</span><b>' + done.length + '</b></div>' +
      '<div class="stat"><span class="lbl dim">Ukupno vrijeme</span><b>' + t + '</b></div>' +
      '<div class="stat"><span class="lbl dim">U tijeku</span><b>' + open + '</b></div>' +
      '<div class="stat"><span class="lbl dim">Prosjek po zadatku</span><b>' + trajanje(avg).replace(/(\d+) (h|min)/g, '$1<small>$2</small>') + '</b></div></div>';
  }

  async function viewList() {
    app.className = 'wrap';
    app.innerHTML = '<p class="spin lbl">Učitavam…</p>';
    var list = await api.listTasks();
    var counts = { otvoreni: 0, novo: 0, u_izradi: 0, zavrseno: 0, svi: list.length };
    list.forEach(function (z) { if (z.status !== 'zavrseno') counts.otvoreni++; if (counts[z.status] != null) counts[z.status]++; });
    var tabs = [['otvoreni', 'Otvoreni'], ['svi', 'Svi'], ['zavrseno', 'Završeni']];
    if (me.is_admin) tabs.splice(1, 0, ['novo', 'Novi'], ['u_izradi', 'U izradi']);
    var shown = list.filter(function (z) {
      return filter === 'svi' || (filter === 'otvoreni' ? z.status !== 'zavrseno' : z.status === filter);
    });
    var canAdd = !me.is_admin && aktivan(me);
    var note = '';
    if (!me.is_admin) {
      note = aktivan(me)
        ? '<div class="note"><p>' + esc(nazivPaketa(me.paket)) + ' je aktivan do <b>' + dan(me.aktivan_do) + '</b>.</p><a class="btn ghost small" href="#/paket">Produlji paket</a></div>'
        : '<div class="note warn"><p>' + (me.aktivan_do ? 'Paket je istekao ' + dan(me.aktivan_do) + '.' : 'Paket još nije aktivan.') + ' Stari zadaci su ti i dalje dostupni, a nove možeš dodavati čim uplata stigne.</p><a class="btn small" href="#/paket">Plati paket</a></div>';
    }
    app.innerHTML =
      '<div class="head"><p class="lbl dim">' + (me.is_admin ? 'Admin' : esc(me.tvrtka || 'TMBingo CRM')) + '</p>' +
      '<div class="hrow"><h1>' + (me.is_admin ? 'Svi zadaci' : 'Bok, ' + esc((me.ime || '').split(' ')[0] || 'dobro došao')) + '</h1>' +
      (canAdd ? '<a class="btn" href="#/novi">+ Novi zadatak</a>' : '') + '</div></div>' +
      note + stats(list) +
      '<div class="tabs lbl" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-f="' + t[0] + '" aria-selected="' + (filter === t[0]) + '"' + (filter === t[0] ? ' class="on"' : '') + '>' + t[1] + '<span>' + counts[t[0]] + '</span></button>'; }).join('') + '</div>' +
      (shown.length
        ? '<div class="list">' + shown.map(function (z) {
            return '<a class="item" href="#/zadatak/' + z.id + '"><span class="id lbl dim">#' + z.id + '</span>' +
              '<span class="t">' + esc(z.naslov) + (me.is_admin ? '<small>' + esc(ime(z.klijent)) + (z.klijent && z.klijent.tvrtka ? ' · ' + esc(z.klijent.tvrtka) : '') + '</small>' : '') + '</span>' +
              st(z.status) + '<span class="d lbl dim">' + datum(z.created_at) + '</span><span class="r lbl">' + (z.minuta ? trajanje(z.minuta) : '·') + '</span></a>';
          }).join('') + '</div>'
        : '<p class="empty">' + (list.length ? 'Ovdje nema zadataka.' : canAdd ? 'Još nema zadataka. Dodaj prvi i javit ćemo se istog dana.' : 'Još nema zadataka.') + '</p>');
    $$('.tabs button').forEach(function (b) { b.onclick = function () { filter = b.dataset.f; viewList(); }; });
  }

  /* ---------- datoteke i linkovi u obrascima ---------- */
  function attachUI(root) {
    var picked = [];
    var drop = $('.drop', root), input = $('input[type=file]', root), out = $('.files', root);
    function draw() {
      out.innerHTML = picked.map(function (f, i) {
        var bad = f.size > MAX;
        return '<div class="file' + (bad ? ' bad' : '') + '"><span>' + esc(f.name) + ' · ' + velicina(f.size) + (bad ? ' · veće od 10 MB, pošalji preko WeTransfera i zalijepi link' : '') + '</span><button type="button" data-i="' + i + '" aria-label="Makni ' + esc(f.name) + '">✕</button></div>';
      }).join('');
      $$('button', out).forEach(function (b) { b.onclick = function () { picked.splice(+b.dataset.i, 1); draw(); }; });
    }
    input.onchange = function () { picked = picked.concat(Array.prototype.slice.call(input.files)); input.value = ''; draw(); };
    ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function () { drop.classList.remove('over'); }); });
    return {
      files: function () { return picked; },
      links: function () {
        return $('[name=links]', root).value.split(/\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
      },
      check: function () {
        if (picked.some(function (f) { return f.size > MAX; })) return 'Neke datoteke su veće od 10 MB. Makni ih i pošalji ih preko WeTransfera, pa zalijepi link.';
        var bad = this.links().filter(function (l) { return !/^https:\/\/\S+\.\S+/.test(l); });
        if (bad.length) return 'Link mora počinjati s https:// (' + bad[0] + ').';
        return '';
      },
      reset: function () { picked = []; draw(); $('[name=links]', root).value = ''; },
    };
  }
  var ATTACH = '<div class="drop"><input type="file" multiple aria-label="Dodaj datoteke"><span class="lbl">+ Dodaj datoteke</span><span class="hint">Povuci ih ovdje ili klikni. Najviše 10 MB po datoteci.</span></div><div class="files"></div>' +
    '<label class="field"><span class="lbl">Veće datoteke: link (WeTransfer, Google Drive…)</span><input class="input" name="links" type="url" inputmode="url" placeholder="https://we.tl/…"></label>';

  /* ---------- novi zadatak ---------- */
  function viewNew() {
    app.className = 'wrap';
    if (me.is_admin || !aktivan(me)) { location.hash = '#/'; return; }
    app.innerHTML = '<div class="head"><a class="back lbl" href="#/">← Zadaci</a><h1>Novi zadatak</h1></div>' +
      '<form class="form" id="f" novalidate>' +
      '<label class="field"><span class="lbl">Što trebaš</span><input class="input" name="naslov" maxlength="200" required placeholder="npr. Plakat za Halloween party"></label>' +
      '<label class="field"><span class="lbl">Opis</span><textarea class="input" name="opis" maxlength="10000" placeholder="Rok, dimenzije, tekst, gdje će se koristiti… Što više detalja, to brže."></textarea></label>' +
      ATTACH + '<p class="err" id="e" hidden></p><div><button class="btn" type="submit">Pošalji zadatak</button></div></form>';
    var f = $('#f'), at = attachUI(f);
    f.onsubmit = async function (ev) {
      ev.preventDefault();
      var e = $('#e'), b = $('button[type=submit]', f), naslov = f.naslov.value.trim();
      e.hidden = true;
      var msg = !naslov ? 'Upiši što trebaš.' : at.check();
      if (msg) { e.textContent = msg; e.hidden = false; return; }
      busy(b, true, 'Šaljem…');
      try {
        var z = await api.createTask({ naslov: naslov, opis: f.opis.value.trim(), files: at.files(), links: at.links() });
        toast('Zadatak je poslan.');
        location.hash = '#/zadatak/' + z.id;
      } catch (err) { e.textContent = err.message; e.hidden = false; busy(b, false); }
    };
  }

  /* ---------- zadatak ---------- */
  function attList(items) {
    if (!items.length) return '';
    return '<div class="att">' + items.map(function (a) {
      return a.vrsta === 'link'
        ? '<a href="' + esc(a.url) + '" target="_blank" rel="noopener noreferrer"><span class="ic">LINK</span>' + esc(a.naziv) + '</a>'
        : '<button type="button" data-file="' + esc(a.putanja) + '"><span class="ic">' + esc((a.naziv.split('.').pop() || 'DAT').slice(0, 4).toUpperCase()) + '</span>' + esc(a.naziv) + (a.velicina ? ' · ' + velicina(a.velicina) : '') + '</button>';
    }).join('') + '</div>';
  }

  async function viewTask(id, quiet) {
    app.className = 'wrap';
    if (!quiet) app.innerHTML = '<p class="spin lbl">Učitavam…</p>';
    var z = await api.getTask(id);
    if (!z) { app.innerHTML = '<div class="head"><a class="back lbl" href="#/">← Zadaci</a><h1>Zadatak ne postoji</h1></div>'; return; }
    var draft = quiet && $('#compose textarea') ? $('#compose textarea').value : '';
    var order = ['novo', 'prihvaceno', 'u_izradi', 'zavrseno'], idx = order.indexOf(z.status);
    var times = { novo: z.created_at, prihvaceno: z.prihvaceno_at, u_izradi: z.u_izradi_at, zavrseno: z.zavrseno_at };
    var steps = '<ol class="steps">' + order.map(function (s, i) {
      return '<li class="' + (i === idx ? 'done now' : i < idx && times[s] ? 'done' : '') + '"><span>' + STATUS[s] + '</span><small>' + (i <= idx && times[s] ? datum(times[s]) : '') + '</small></li>';
    }).join('') + '</ol>';
    var adminBox = me.is_admin
      ? '<div class="box"><p class="lbl">Status</p><div class="seg lbl">' + order.map(function (s) { return '<button type="button" data-s="' + s + '" class="' + s + (s === z.status ? ' on' : '') + '">' + STATUS[s] + '</button>'; }).join('') + '</div><p class="hint">Kad označiš Završeno, klijent dobije e-mail.</p></div>' +
        '<div class="box"><p class="lbl">Vrijeme izrade</p><p class="big">' + trajanje(z.minuta) + '</p>' +
        '<form class="time" id="tf"><label><span class="lbl dim">Sati</span><input type="number" name="h" min="0" max="999" inputmode="numeric" value="' + Math.floor(z.minuta / 60) + '"></label><label><span class="lbl dim">Minute</span><input type="number" name="m" min="0" max="59" inputmode="numeric" value="' + (z.minuta % 60) + '"></label><button class="btn small" type="submit">Spremi</button></form>' +
        '<div class="quick lbl"><button type="button" class="btn ghost small" data-add="15">+15 min</button><button type="button" class="btn ghost small" data-add="30">+30 min</button><button type="button" class="btn ghost small" data-add="60">+1 h</button></div></div>' +
        '<div class="box"><p class="lbl">Klijent</p><p>' + esc(ime(z.klijent)) + (z.klijent && z.klijent.tvrtka ? '<br><span class="dim">' + esc(z.klijent.tvrtka) + '</span>' : '') + '<br><a href="mailto:' + esc(z.klijent && z.klijent.email) + '">' + esc(z.klijent && z.klijent.email) + '</a></p></div>'
      : '<div class="box"><p class="lbl">Vrijeme izrade</p><p class="big">' + (z.minuta ? trajanje(z.minuta) : '·') + '</p></div>';
    var base = z.prilozi.filter(function (a) { return !a.poruka_id; });
    var thread = z.poruke.map(function (p) {
      var mine = p.autor_id === me.id;
      var team = p.autor ? p.autor.is_admin : !mine;
      var who = mine ? ime(me) : team ? 'TMBingo' : ime(p.autor);
      return '<article class="msg' + (mine ? ' mine' : '') + (team ? ' team' : '') + '"><header><b>' + esc(who) + '</b><span class="lbl dim">' + datum(p.created_at, true) + '</span></header>' +
        (p.tekst ? '<p>' + linkify(p.tekst) + '</p>' : '') + attList(z.prilozi.filter(function (a) { return a.poruka_id === p.id; })) + '</article>';
    }).join('');
    app.innerHTML = '<div class="head"><a class="back lbl" href="#/">← Zadaci</a><div class="hrow"><h1>' + esc(z.naslov) + '</h1>' + st(z.status) + '</div>' +
      '<p class="lbl dim">#' + z.id + ' · ' + datum(z.created_at, true) + (me.is_admin ? ' · ' + esc(ime(z.klijent)) : '') + '</p></div>' +
      '<div class="task"><div>' + (z.opis ? '<p class="opis">' + linkify(z.opis) + '</p>' : '') + attList(base) +
      '<section class="thread"><p class="lbl">Poruke i komentari</p>' + (thread || '<p class="empty" style="padding:24px 0">Još nema poruka.</p>') +
      '<form class="compose" id="compose" novalidate><label class="field"><span class="lbl">Nova poruka</span><textarea class="input" name="tekst" maxlength="10000" placeholder="' + (me.is_admin ? 'Napiši klijentu…' : 'Pitanje, komentar ili izmjena…') + '"></textarea></label>' +
      ATTACH + '<p class="err" id="e" hidden></p><div class="actions"><span class="hint">' + (me.is_admin ? 'Klijent dobije obavijest e-mailom.' : 'Javljamo se istog dana.') + '</span><button class="btn" type="submit">Pošalji</button></div></form></section></div>' +
      '<aside class="side"><div class="box"><p class="lbl">Tijek</p>' + steps + '</div>' + adminBox + '</aside></div>';
    if (draft) $('#compose textarea').value = draft;

    $$('[data-file]').forEach(function (b) {
      b.onclick = async function () {
        var w = window.open('', '_blank');
        try { var u = await api.fileUrl(b.dataset.file); if (w) w.location = u; else location.href = u; }
        catch (err) { if (w) w.close(); toast(err.message); }
      };
    });
    var f = $('#compose'), at = attachUI(f);
    f.onsubmit = async function (ev) {
      ev.preventDefault();
      var e = $('#e'), b = $('button[type=submit]', f), tekst = f.tekst.value.trim();
      e.hidden = true;
      var msg = !tekst && !at.files().length && !at.links().length ? 'Napiši poruku ili dodaj datoteku.' : at.check();
      if (msg) { e.textContent = msg; e.hidden = false; return; }
      busy(b, true);
      try { await api.addMessage(z, { tekst: tekst, files: at.files(), links: at.links() }); f.tekst.value = ''; await viewTask(id, true); }
      catch (err) { e.textContent = err.message; e.hidden = false; busy(b, false); }
    };
    if (me.is_admin) {
      $$('.seg button').forEach(function (b) {
        b.onclick = async function () {
          var s = b.dataset.s;
          if (s === z.status) return;
          if (s === 'zavrseno' && !z.minuta && !confirm('Vrijeme izrade je 0 min. Svejedno označiti kao završeno?')) return;
          if (s === 'zavrseno' && !confirm('Označiti kao završeno? Klijent će dobiti e-mail.')) return;
          b.disabled = true;
          try { await api.setStatus(z, s); toast('Status: ' + STATUS[s] + (s === 'zavrseno' ? '. Klijent je obaviješten.' : '.')); await viewTask(id, true); }
          catch (err) { toast(err.message); b.disabled = false; }
        };
      });
      var save = async function (min) {
        try { await api.setMinutes(z, Math.max(0, min)); toast('Vrijeme je spremljeno.'); await viewTask(id, true); } catch (err) { toast(err.message); }
      };
      $('#tf').onsubmit = function (ev) { ev.preventDefault(); save((parseInt(this.h.value, 10) || 0) * 60 + Math.min(59, parseInt(this.m.value, 10) || 0)); };
      $$('[data-add]').forEach(function (b) { b.onclick = function () { save(z.minuta + +b.dataset.add); }; });
    }
    clearInterval(timer);
    timer = setInterval(function () {
      if (document.hidden || location.hash !== '#/zadatak/' + id) return;
      if (document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName) && document.activeElement.value) return;
      viewTask(id, true).catch(function () {});
    }, 30000);
  }

  /* ---------- paket (klijent: produljenje) ---------- */
  async function viewPaket() {
    app.className = 'wrap';
    app.innerHTML = '<div class="head"><a class="back lbl" href="#/">← Zadaci</a><h1>Paket</h1>' +
      '<p>' + (aktivan(me) ? 'Pristup je aktivan do <b>' + dan(me.aktivan_do) + '</b>. Uplatom ga produljuješ za još mjesec ili godinu dana, a možeš i promijeniti paket.' : 'Uplati paket i odmah nakon potvrde uplate možeš dodavati nove zadatke.') + '</p></div>' +
      '<div class="picker" id="picker"></div><div><button class="btn" type="button" id="go">Prikaži podatke za uplatu</button></div><div id="out"></div>';
    var m = await import('/app/odabir.mjs');
    var izbor = m.odabir($('#picker'), { paket: me.paket || 'tmbingo', samoMjesecni: true });
    $('#go').onclick = async function () {
      var b = this; busy(b, true, 'Pripremam…');
      try {
        var r = await api.renew(izbor.get());
        b.parentNode.remove();
        $('#picker').remove();
        $('#out').innerHTML = (r.naziv ? '<p class="lbl" style="margin-bottom:12px">' + esc(r.naziv) + '</p>' : '') + window.TMB_UPLATA(r.uplata) + '<p class="hint" style="margin-top:20px">Podatke smo poslali i na tvoj e-mail. Čim uplata stigne, pristup se produljuje i dobiješ potvrdu.</p>';
      } catch (err) { toast(err.message); busy(b, false); }
    };
  }

  /* ---------- admin: narudžbe ---------- */
  async function viewOrders() {
    if (!me.is_admin) { location.hash = '#/'; return; }
    app.className = 'wrap';
    app.innerHTML = '<p class="spin lbl">Učitavam…</p>';
    var list = await api.listOrders();
    var waiting = list.filter(function (n) { return n.status === 'ceka_uplatu'; });
    var month = new Date(); month = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
    var novih = list.filter(function (n) { return n.novi && n.status !== 'otkazano' && n.created_at >= month; }).length;
    var placeno = list.filter(function (n) { return n.status === 'placeno' && n.placeno_at >= month; }).reduce(function (s, n) { return s + n.iznos_centi; }, 0);
    app.innerHTML = '<div class="head"><p class="lbl dim">Admin</p><h1>Narudžbe</h1></div>' +
      '<div class="stats"><div class="stat"><span class="lbl dim">Čeka uplatu</span><b>' + waiting.length + '</b></div>' +
      '<div class="stat"><span class="lbl dim">Novih ovaj mjesec</span><b>' + novih + '<small>/ 10</small></b></div>' +
      '<div class="stat"><span class="lbl dim">Uplaćeno ovaj mjesec</span><b>' + (placeno / 100).toLocaleString('hr-HR') + '<small>€</small></b></div>' +
      '<div class="stat"><span class="lbl dim">Ukupno narudžbi</span><b>' + list.length + '</b></div></div>' +
      '<p class="hint" style="margin-bottom:16px">Kad uplata stigne na račun (provjeri poziv na broj), klikni „Potvrdi uplatu“. Klijent tada dobije e-mail s linkom za prijavu, a paket se produlji za mjesec dana.</p>' +
      '<div class="rows"><div class="row th lbl"><span>Poziv</span><span>Klijent</span><span>E-mail</span><span>Iznos</span><span>Status</span><span></span></div>' +
      (list.length ? list.map(function (n) {
        return '<div class="row"><span class="lbl">' + esc(n.poziv) + '<small>' + datum(n.created_at) + '</small></span>' +
          '<span>' + esc(n.ime) + (n.tvrtka ? '<small>' + esc(n.tvrtka) + '</small>' : '') + (n.napomena ? '<small>„' + esc(n.napomena) + '“</small>' : '') + '</span>' +
          '<span><a href="mailto:' + esc(n.email) + '">' + esc(n.email) + '</a><small>' + (n.novi ? 'Novi klijent' : 'Produljenje') + (n.oib ? ' · OIB ' + esc(n.oib) : '') + '</small></span>' +
          '<span class="lbl">' + (n.iznos_centi / 100).toLocaleString('hr-HR') + ' €<small>' + esc(nazivPaketa(n.paket)) + (n.period === 'godisnje' ? ', godišnje' : n.period === 'jednokratno' ? '' : ', mjesečno') + '</small></span>' + st(n.status, NARUDZBA) +
          '<span class="acts">' + (n.status === 'ceka_uplatu' ? '<button class="btn small green" data-ok="' + n.id + '">Potvrdi uplatu</button><button class="btn ghost small" data-no="' + n.id + '">Otkaži</button>' : n.placeno_at ? '<span class="lbl dim">' + datum(n.placeno_at) + '</span>' : '') + '</span></div>';
      }).join('') : '<p class="empty">Još nema narudžbi.</p>') + '</div>';
    $$('[data-ok]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('Potvrditi da je uplata stigla? Klijent će dobiti e-mail s linkom za prijavu.')) return;
        busy(b, true, 'Potvrđujem…');
        try { var r = await api.confirmOrder(+b.dataset.ok); toast(r.poslano ? 'Uplata potvrđena, klijent je dobio e-mail.' : 'Uplata potvrđena.' + (r.demo ? ' (demo)' : ' E-mail nije poslan, provjeri SMTP postavke.')); viewOrders(); }
        catch (err) { toast(err.message); busy(b, false); }
      };
    });
    $$('[data-no]').forEach(function (b) {
      b.onclick = async function () {
        if (!confirm('Otkazati ovu narudžbu? Mjesto se oslobađa.')) return;
        try { await api.cancelOrder(+b.dataset.no); viewOrders(); } catch (err) { toast(err.message); }
      };
    });
  }

  /* ---------- admin: klijenti ---------- */
  async function viewClients() {
    if (!me.is_admin) { location.hash = '#/'; return; }
    app.className = 'wrap';
    app.innerHTML = '<p class="spin lbl">Učitavam…</p>';
    var res = await Promise.all([api.listClients(), api.listTasks()]);
    var clients = res[0], tasks = res[1];
    app.innerHTML = '<div class="head"><p class="lbl dim">Admin</p><h1>Klijenti</h1></div>' + stats(tasks) +
      '<div class="rows"><div class="row cl th lbl"><span>Klijent</span><span>E-mail</span><span>Paket</span><span>Zadaci</span><span>Vrijeme</span></div>' +
      (clients.length ? clients.map(function (c) {
        var mine = tasks.filter(function (z) { return z.klijent_id === c.id; });
        var done = mine.filter(function (z) { return z.status === 'zavrseno'; }).length;
        var min = mine.reduce(function (s, z) { return s + (z.minuta || 0); }, 0);
        return '<div class="row cl"><span>' + esc(c.ime || c.email) + '<small>' + esc([c.tvrtka, c.paket && nazivPaketa(c.paket)].filter(Boolean).join(' · ')) + '</small></span><span><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a></span>' +
          (aktivan(c) ? '<span class="st placeno">Do ' + dan(c.aktivan_do) + '</span>' : '<span class="st otkazano">' + (c.aktivan_do ? 'Istekao ' + dan(c.aktivan_do) : 'Nije aktivan') + '</span>') +
          '<span class="lbl">' + done + ' / ' + mine.length + '<small>završeno</small></span><span class="r lbl">' + trajanje(min) + '</span></div>';
      }).join('') : '<p class="empty">Još nema klijenata.</p>') + '</div>';
  }

  /* ---------- usmjeravanje ---------- */
  async function route_() {
    clearInterval(timer);
    var h = location.hash.replace(/^#\/?/, ''), parts = h.split('/');
    // poveznica za prijavu dolazi s tokenom u adresi; Supabase ga sam pročita
    if (/access_token|error_description/.test(h)) return;
    renderBar(parts[0]);
    if (!me) return viewLogin();
    try {
      if (parts[0] === 'zadatak' && parts[1]) await viewTask(+parts[1]);
      else if (parts[0] === 'novi') viewNew();
      else if (parts[0] === 'narudzbe') await viewOrders();
      else if (parts[0] === 'klijenti') await viewClients();
      else if (parts[0] === 'paket') await viewPaket();
      else await viewList();
    } catch (err) {
      console.error(err);
      app.innerHTML = '<div class="head"><h1>Nešto nije u redu</h1><p class="err">' + esc(err.message) + '</p><p><a class="link" href="#/">Natrag na zadatke</a></p></div>';
    }
    window.scrollTo(0, 0);
  }

  async function start() {
    renderDemo();
    var h = location.hash;
    if (/error_description/.test(h)) {
      var m = decodeURIComponent((h.match(/error_description=([^&]+)/) || [])[1] || '').replace(/\+/g, ' ');
      history.replaceState(null, '', location.pathname + location.search);
      toast(/expired|invalid/i.test(m) ? 'Link za prijavu je istekao. Zatraži novi.' : m);
    }
    try { me = await api.session(); } catch (err) { console.error(err); me = null; }
    if (me && /access_token/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#/');
    route_();
  }

  window.addEventListener('hashchange', route_);
  // Supabase javlja SIGNED_IN i kad se kartica ponovno otvori, zato reagiramo samo na stvarnu promjenu
  api.onAuth(function (ev) {
    if (ev === 'SIGNED_IN' && !me) start();
    else if (ev === 'SIGNED_OUT' && me) { me = null; route_(); }
  });
  start();
})();
