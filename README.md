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

- `usluge/` i podstranice za svaku uslugu (web, web trgovina, društvene mreže, dizajn, branding, tiskovine, banneri, newsletter, SEO, hosting, održavanje); stil u `assets/stranica.css`
- `blog/` – blog; novi članak = nova mapa `blog/naziv-clanka/index.html` po uzoru na postojeće, plus poveznica u `blog/index.html`, `sitemap.xml` i `llms.txt`
- `sitemap.xml`, `robots.txt` – za Google i Bing
- `llms.txt` – sažetak za AI alate (ChatGPT, Perplexity, Claude)
- Strukturirani podaci (JSON-LD) su u `<head>` svake stranice. **Kad mijenjaš cijene paketa, promijeni ih i tamo, u podstranicama i u `llms.txt`.**

## Cjenik i bazne cijene (od 17. 11. 2026.)

Propis traži baznu (sidrenu) cijenu uz svaku cijenu i CSV cjenik na webu. Sve je u jednoj datoteci:

1. Promijeni cijenu u `app/cjenik.mjs` (polja `bazna` i `datum` ne diraj), u `app/paketi.mjs` ili `app/usluge.mjs` i na naslovnoj.
2. Povećaj `VERZIJA` i upiši `VRIJEDI_OD` u `app/cjenik.mjs`.
3. Pokreni `node cjenik/izradi.mjs`: napravi novi CSV (`cjenik/<OIB>_..._<datum>.csv` i `cjenik/cjenik.csv`), stari premjesti u `cjenik/arhiv/` i osvježi tablicu na `/cjenik/`.
4. Commit i objava isti dan, najkasnije do 11 sati. Arhivu ne briši bar mjesec dana.

Nova usluga ili paket: dodaj stavku u `app/cjenik.mjs` s današnjim datumom kao datumom bazne cijene.

## Pravne stranice

- `uvjeti.html` – uvjeti poslovanja, pravo na raskid i obrazac
- `privatnost.html` – privatnost i podaci o obrtu
- `kolacici.html` – kolačići (stranica ih ne postavlja)

Fontovi (`assets/fonts/`) i Lenis (`assets/js/`) su na našem serveru, bez učitavanja s Googlea ili unpkg-a. Ako dodaš analitiku ili chat, prvo treba dodati traženje pristanka.

## TMBingo CRM

Narudžba paketa (`/paket/`), CRM za klijente i admin (`/app/`), Netlify funkcije (`netlify/`) i baza (`supabase/schema.sql`). Postavljanje i svakodnevni rad opisani su u [CRM.md](CRM.md).
