// CJENIK S BAZNIM CIJENAMA (Zakon o zaštiti potrošača i pravilnici o baznoj cijeni i objavi cjenika, NN 132/2026, od 17. 11. 2026.)
//
// Ovo je jedini izvor za stranicu /cjenik/, kalkulator i CSV datoteku koju propis traži.
// Kad promijeniš cijenu:
//   1. promijeni "cijena" ovdje ("bazna" i "datum" NE diraj, oni ostaju kao na dan prve ponude),
//   2. promijeni cijenu i u app/paketi.mjs ili app/usluge.mjs i na naslovnoj (vidi README),
//   3. pokreni:  node cjenik/izradi.mjs   (napravi novi CSV i tablicu na /cjenik/),
//   4. commit i objava ISTI DAN do 11 sati. Stari CSV ostaje u mapi cjenik/arhiv/ barem 15 dana.
//
// bazna = cijena na dan 10. 9. 2026. Usluge TMBinga ponuđene su prvi put poslije tog dana,
// pa je bazna cijena ona s dana prve ponude, a taj datum se mora navesti (polje "datum").

export const OBRT = {
  naziv: 'Studio23k, vl. Tonći Morić',
  oib: '13393375189',
  adresa: 'Jakova Gotovca 18, 23000 Zadar',
};

// verzija CSV-a: povećaj za 1 kod svake objave novog cjenika
export const VERZIJA = 1;
// kada cjenik stupa na snagu (ide u ime datoteke, oblik GGGGMMDD_SSMM)
export const VRIJEDI_OD = { datum: '2026-11-17', vrijeme: '08:00' };

export const GRUPE = {
  paketi: 'TMBingo paketi (bez obveze trajanja)',
  jednokratno: 'Jednokratne usluge',
  zakon: 'Cjenik i bazna cijena za tvoj web',
};

// cijena i bazna su u eurima; "od: true" znači da je to početna cijena (točan iznos u ponudi)
export const STAVKE = [
  { sifra: 'TMB-START-M', grupa: 'paketi', naziv: 'Start paket', opseg: '8 objava mjesečno i održavanje postojećeg weba', jedinica: 'mjesečno', cijena: 199, bazna: 199, datum: '2026-10-31' },
  { sifra: 'TMB-START-G', grupa: 'paketi', naziv: 'Start paket, godišnje plaćanje', opseg: '12 mjeseci, 2 mjeseca gratis', jedinica: 'godišnje', cijena: 1990, bazna: 1990, datum: '2026-10-31' },
  { sifra: 'TMB-PAKET-M', grupa: 'paketi', naziv: 'TMBingo paket', opseg: 'Web, hosting, održavanje, dizajn i društvene mreže', jedinica: 'mjesečno', cijena: 399, bazna: 399, datum: '2026-10-29' },
  { sifra: 'TMB-PAKET-G', grupa: 'paketi', naziv: 'TMBingo paket, godišnje plaćanje', opseg: '12 mjeseci, 2 mjeseca gratis', jedinica: 'godišnje', cijena: 3990, bazna: 3990, datum: '2026-10-31' },
  { sifra: 'TMB-PRO-M', grupa: 'paketi', naziv: 'Pro paket', opseg: 'Sve iz TMBingo paketa, dva zadatka istovremeno, prednost', jedinica: 'mjesečno', cijena: 749, bazna: 749, datum: '2026-10-31' },
  { sifra: 'TMB-PRO-G', grupa: 'paketi', naziv: 'Pro paket, godišnje plaćanje', opseg: '12 mjeseci, 2 mjeseca gratis', jedinica: 'godišnje', cijena: 7490, bazna: 7490, datum: '2026-10-31' },
  { sifra: 'TMB-WEB14', grupa: 'jednokratno', naziv: 'Web za 14 dana', opseg: 'Nova web stranica, dizajn prvo u Figmi, gotovo za 14 dana', jedinica: 'jednokratno', cijena: 1490, bazna: 1490, datum: '2026-10-31' },
  { sifra: 'TMB-LOGO', grupa: 'jednokratno', naziv: 'Logo', opseg: 'Znak i logotip u dvije-tri varijante, rok 7 dana', jedinica: 'jednokratno', cijena: 290, bazna: 290, datum: '2026-11-05' },
  { sifra: 'TMB-IDENTITET', grupa: 'jednokratno', naziv: 'Vizualni identitet', opseg: 'Logo, boje, fontovi, pravila korištenja, predlošci za mreže, rok 14 dana', jedinica: 'jednokratno', cijena: 690, bazna: 690, datum: '2026-11-05' },
  { sifra: 'TMB-TISAK', grupa: 'jednokratno', naziv: 'Tiskovina', opseg: 'Vizitka, letak, jelovnik ili plakat, pripremljeno za tisak, rok 3 dana', jedinica: 'po dizajnu', od: true, cijena: 90, bazna: 90, datum: '2026-11-05' },
  { sifra: 'TMB-OBJAVE', grupa: 'jednokratno', naziv: 'Objave za mreže', opseg: 'Set od 8 dizajniranih objava, rok 5 dana', jedinica: 'po setu', cijena: 149, bazna: 149, datum: '2026-11-05' },
  { sifra: 'TMB-BANNERI', grupa: 'jednokratno', naziv: 'Web banneri', opseg: 'Oglas u svim potrebnim dimenzijama, rok 3 dana', jedinica: 'po setu', cijena: 99, bazna: 99, datum: '2026-11-05' },
  { sifra: 'TMB-TRGOVINA', grupa: 'jednokratno', naziv: 'Web trgovina', opseg: 'Katalog, košarica, kartično plaćanje i dostava, rok oko 30 dana', jedinica: 'jednokratno', od: true, cijena: 2490, bazna: 2490, datum: '2026-11-05' },
  { sifra: 'TMB-CRM', grupa: 'jednokratno', naziv: 'CRM po mjeri', opseg: 'Sustav za upite, zadatke i klijente', jedinica: 'jednokratno', od: true, cijena: 1200, bazna: 1200, datum: '2026-11-05' },
  { sifra: 'TMB-SAT', grupa: 'jednokratno', naziv: 'Rad po satu', opseg: 'Izmjene na postojećem webu i hitni popravci', jedinica: 'po satu', cijena: 40, bazna: 40, datum: '2026-11-05' },
  { sifra: 'TMB-CJENIK', grupa: 'zakon', naziv: 'CSV cjenik i sidrena cijena', opseg: 'CSV cjenik na webu i bazna cijena uz cijene, do 50 stavki, jedna lokacija, rok 2 radna dana', jedinica: 'jednokratno', cijena: 94, bazna: 94, datum: '2026-11-17' },
  { sifra: 'TMB-CJENIK-LOK', grupa: 'zakon', naziv: 'CSV cjenik, dodatna lokacija', opseg: 'Svaka dodatna poslovnica ili prodajno mjesto s drugim cijenama', jedinica: 'po lokaciji', cijena: 49, bazna: 49, datum: '2026-11-17' },
];

export const eur = (n) => n.toLocaleString('de-DE') + ' €'; // 1490 → "1.490 €"
export const datumHr = (iso) => { const [g, m, d] = iso.split('-').map(Number); return `${d}. ${m}. ${g}.`; };

// ime datoteke prema pravilniku: OIB, sva prodajna mjesta, usluge, broj pohrane, vrijeme GGGGMMDD_SSMM
export const imeCsv = () => `${OBRT.oib}_ZA_SVA_PRODAJNA_MJESTA_USLUGE_${String(VERZIJA).padStart(3, '0')}_${VRIJEDI_OD.datum.replace(/-/g, '')}_${VRIJEDI_OD.vrijeme.replace(':', '')}.csv`;
