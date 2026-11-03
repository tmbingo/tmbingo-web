# tmbingo.com

Web stranica TMBingo, „Tvoj kreativni tim u jednom paketu“. Statička stranica (HTML, CSS i JS u jednoj datoteci), bez builda.

## Struktura

- `index.html` – cijela stranica
- `assets/` – fotografije, logo, favicon i slika za dijeljenje (og-image)
- `netlify.toml` – postavke za Netlify

## Broj slobodnih mjesta

Na dnu `index.html` promijeni ova dva retka:

```js
var SLOBODNA_MJESTA = 10;   // koliko je mjesta još slobodno ovaj mjesec (0 do 10)
var MJESEC = 'studeni 2026';
```

Commit na `main` i Netlify sam objavi novu verziju za minutu.

## Objava na Netlify

1. Netlify → Add new site → Import an existing project → GitHub → `tmbingo/tmbingo-web`.
2. Build command: prazno. Publish directory: `.` (već piše u `netlify.toml`).
3. Deploy. Provjeri testnu adresu (`*.netlify.app`).
4. Domena: Site configuration → Domain management → Add domain → `tmbingo.com`, pa promijeni DNS kod registra prema uputama Netlifyja.

## Lokalni pregled

```sh
python3 -m http.server 8000
```

pa otvori http://localhost:8000.

## SEO i AI pretrage

- `izrada-web-stranica-zadar/`, `drustvene-mreze-zadar/`, `graficki-dizajn-zadar/` – podstranice usluga (stil u `assets/stranica.css`)
- `blog/` – blog; novi članak = nova mapa `blog/naziv-clanka/index.html` po uzoru na postojeće, plus poveznica u `blog/index.html`, `sitemap.xml` i `llms.txt`
- `sitemap.xml`, `robots.txt` – za Google i Bing
- `llms.txt` – sažetak za AI alate (ChatGPT, Perplexity, Claude)
- Strukturirani podaci (JSON-LD) su u `<head>` svake stranice. **Kad mijenjaš cijene paketa, promijeni ih i tamo, u podstranicama i u `llms.txt`.**

## Pravne stranice

- `uvjeti.html` – uvjeti poslovanja, pravo na raskid i obrazac
- `privatnost.html` – privatnost i podaci o obrtu
- `kolacici.html` – kolačići (stranica ih ne postavlja)

Fontovi (`assets/fonts/`) i Lenis (`assets/js/`) su na našem serveru, bez učitavanja s Googlea ili unpkg-a. Ako dodaš analitiku ili chat, prvo treba dodati traženje pristanka.

## TMBingo CRM

Narudžba paketa (`/paket/`), CRM za klijente i admin (`/app/`), Netlify funkcije (`netlify/`) i baza (`supabase/schema.sql`). Postavljanje i svakodnevni rad opisani su u [CRM.md](CRM.md).
