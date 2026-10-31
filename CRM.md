# TMBingo CRM

Klijent naruči paket na `/paket/` i dobije uplatnicu s HUB3 barkodom i QR kodom. Kad potvrdiš uplatu, dobije e-mail s linkom za prijavu. U CRM-u na `/app/` dodaje zadatke, šalje datoteke do 10 MB (ili WeTransfer link) i dopisuje se s tobom. Ti u adminu prihvaćaš zadatke, upisuješ vrijeme i označavaš ih kao završene, a klijent tada dobije e-mail.

Demo s izmišljenim podacima otvaraš na `/app/?demo`. Gore u zelenoj traci možeš prebaciti prikaz između klijenta i admina.

## Kako radi

| Dio | Gdje |
| --- | --- |
| Narudžba i uplatnica | `paket/index.html` → `/api/narudzba` |
| CRM za klijente i admin | `app/` (HTML, CSS, JS, bez builda) |
| Baza, prijava i datoteke | Supabase (`supabase/schema.sql`) |
| Potvrda uplate | `/api/potvrdi-uplatu` (samo admin) |
| E-mail obavijesti | `/api/obavijest`, šalje se preko Gmaila |

Pravila pristupa su u bazi: klijent vidi samo svoje zadatke, poruke i datoteke. Zadatke dodaje samo dok mu je paket aktivan, ali stare vidi uvijek. Status i vrijeme mijenja samo admin.

## Postavljanje (jednom)

### 1. Supabase

1. Projekt „TMBingo paket“ (`edspnavvakpmcrwyjzes`, Pariz, EU) već postoji.
2. ✓ Baza je postavljena: `supabase/schema.sql` je pokrenut preko Supabase konektora (tablice, pravila pristupa i spremište `prilozi`). Za novi projekt: **SQL Editor** → zalijepi cijelu datoteku → Run.
3. **Authentication → Sign In / Providers**: isključi **Allow new users to sign up**. Račune otvara samo potvrda uplate.
4. **Authentication → URL Configuration**:
   - Site URL: `https://tmbingo.com`
   - Redirect URLs: `https://tmbingo.com/app/`, `https://tmbingo.netlify.app/app/`, `https://*--tmbingo.netlify.app/app/`
5. **Authentication → Emails → SMTP Settings**: uključi Custom SMTP (bez toga Supabase šalje samo nekoliko e-mailova na sat).
   - Host `smtp.gmail.com`, port `465`, korisnik `tmbingo@gmail.com`, lozinka je lozinka za aplikacije (korak 2), pošiljatelj `TMBingo`.
6. **Authentication → Emails → Templates → Magic Link** (predložak je niže).
7. ✓ Admin račun `tmbingo@gmail.com` je otvoren i postavljen za admina. Za drugi admin račun: **Authentication → Users → Add user → Create new user**, upiši `tmbingo@gmail.com`, uključi Auto Confirm. Zatim u SQL Editoru pokreni:
   ```sql
   update public.profiles set is_admin = true where email = 'tmbingo@gmail.com';
   ```
8. **Project Settings → API Keys**: *Publishable* ključ je već u `app/config.js`. *Secret* ključ (ili stari *service_role*) ide samo u Netlify.

### 2. Gmail lozinka za aplikacije

Google račun tmbingo@gmail.com → Sigurnost → uključi potvrdu u 2 koraka → **Lozinke aplikacija** → nova lozinka „TMBingo“. Ta lozinka od 16 znakova ide u Supabase SMTP i u Netlify (`SMTP_PASS`).

### 3. Netlify varijable

Netlify → Site configuration → **Environment variables**:

| Ime | Vrijednost |
| --- | --- |
| `SUPABASE_URL` | Project URL iz Supabasea |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret ključ (`sb_secret_…`) ili stari service_role (tajan, samo ovdje) |
| `SMTP_USER` | `tmbingo@gmail.com` |
| `SMTP_PASS` | lozinka za aplikacije |
| `IBAN` | (nije obavezno) zadano je `HR7824070001100756977` (OTP banka) |
| `REVOLUT_LINK` | (nije obavezno) Revolut Business link za plaćanje karticom |
| `ADMIN_EMAIL` | (nije obavezno) kamo stižu obavijesti, zadano `tmbingo@gmail.com` |
| `SITE_URL` | (nije obavezno) adresa u linkovima e-mailova, zadano je adresa s koje je stigao zahtjev |
| `PRIMATELJ_IME` | (nije obavezno) zadano `Studio23k, vl. T. Morić` (najviše 25 znakova za barkod) |

Nakon spremanja: Deploys → Trigger deploy.

### 4. Javni ključ u stranici

✓ `app/config.js` već ima Project URL i Publishable ključ (javan po namjeni). Demo i dalje možeš otvoriti na `/app/?demo`.

## Paketi i cijene

Paketi su u `app/paketi.mjs` (naziv, cijena mjesečno, godišnje ili jednokratno, opis i koliko od 10 mjesečnih mjesta zauzima). Iz te datoteke čitaju stranica za narudžbu, CRM i server, koji računa iznos na uplatnici. Naslovna (`index.html`, sekcija `#paket`) i tablica u `uvjeti.html` imaju iste cijene upisane ručno, pa ih kod promjene ispravi i tamo.

Godišnja uplata produljuje pristup za 12 mjeseci, mjesečna i jednokratna za mjesec dana. Pro zauzima 2 mjesta.

## Predložak e-maila za prijavu (Supabase → Magic Link)

Naslov: `Tvoj link za prijavu u TMBingo`

```html
<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0b0b0b">
  <div style="background:#000;color:#fff;padding:18px 24px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;font-size:13px">TMBingo</div>
  <div style="padding:28px 24px">
    <h1 style="font-size:26px;margin:0 0 18px">Prijava u TMBingo CRM</h1>
    <p style="font-size:16px;line-height:1.55">Klikni na gumb i odmah si prijavljen. Link vrijedi sat vremena i može se iskoristiti jednom.</p>
    <p style="margin:24px 0"><a href="{{ .ConfirmationURL }}" style="background:#0b0b0b;color:#fff;text-decoration:none;padding:14px 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:600">Prijavi se</a></p>
    <p style="font-size:14px;color:#8a8a8a">Ako nisi tražio ili tražila prijavu, slobodno zanemari ovaj e-mail.</p>
  </div>
</div>
```

## Svakodnevno

- **Nova narudžba**: stiže ti e-mail. Kad uplata s tim pozivom na broj (npr. `2026-12`) sjedne na račun, otvori `/app/#/narudzbe` → **Potvrdi uplatu**. Klijent dobije link za prijavu, a paket mu je aktivan mjesec dana. Svaka iduća potvrda produljuje ga za još mjesec.
- **Novi zadatak ili poruka od klijenta**: stiže ti e-mail s poveznicom na zadatak.
- **Zadatak**: Prihvaćeno → U izradi → Završeno. Vrijeme upisuješ u satima i minutama ili gumbima +15 min, +30 min i +1 h. Kad označiš Završeno, klijent dobije e-mail.
- **Nepročitano**: zadaci s novom porukom ili novim zadatkom imaju zelenu oznaku „1 novo“ i stoje na vrhu popisa. Broj zadataka s novostima vidiš uz **Zadaci** u traci i u naslovu kartice preglednika, a provjerava se svakih 30 sekundi. Kartica **Nepročitano** pokazuje samo njih. Klijent isto tako vidi tvoje odgovore i promjene statusa.
- **Mjesta**: kad je baza spojena, broj slobodnih mjesta na naslovnoj i na `/paket/` računa se sam iz narudžbi novih klijenata (najviše 10 mjesečno, `MAX_KLIJENATA`).

## Lokalno

`supabase/schema.sql` je testiran na PostgreSQL 16 sa simulacijom Supabase uloga: klijent ne vidi tuđe zadatke, ne može mijenjati status ni vrijeme, ne može se postaviti za admina i ne može slati datoteke veće od 10 MB ni u tuđu mapu.
