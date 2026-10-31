// Paketi i cijene. Ovu datoteku koriste i stranica za narudžbu, i CRM, i server (iznos na uplatnici).
// Cijene su u centima. Naslovna (index.html, sekcija #paket) ima iste podatke upisane ručno, pa ih promijeni i tamo.
export const PAKETI = {
  start: {
    naziv: 'Start',
    uplata: 'TMBingo Start',
    mjesecno: 19900,
    godisnje: 199000,
    mjesta: 1,
    kratko: 'Društvene mreže i održavanje weba',
    stavke: ['Društvene mreže: 8 objava mjesečno', 'Održavanje postojećeg weba', 'Jedan zadatak u isto vrijeme', 'Svaka objava prvo u Figmi'],
  },
  tmbingo: {
    naziv: 'TMBingo paket',
    uplata: 'TMBingo paket',
    mjesecno: 39900,
    godisnje: 399000,
    mjesta: 1,
    istaknut: true,
    kratko: 'Web, dizajn i društvene mreže',
    stavke: ['Web stranice, hosting i održavanje', 'Logo, branding i tiskani materijali', 'Društvene mreže, web banneri i newsletter', 'Zadaci redom, jedan po jedan'],
  },
  pro: {
    naziv: 'Pro',
    uplata: 'TMBingo Pro',
    mjesecno: 74900,
    godisnje: 749000,
    mjesta: 2,
    kratko: 'Za brendove kojima treba više i brže',
    stavke: ['Sve iz TMBingo paketa', 'Dva zadatka u isto vrijeme', 'Prednost u redu', 'Mjesečni video poziv za plan'],
  },
  web: {
    naziv: 'Web za 14 dana',
    uplata: 'TMBingo Web 14 dana',
    jednokratno: 149000,
    mjesta: 1,
    kratko: 'Nova web stranica, bez pretplate',
    stavke: ['Nova web stranica za 14 dana', 'Dizajn prvo u Figmi, zatim izrada', 'Plaća se jednom', 'Održavanje poslije kroz Start paket'],
  },
};

export const MJESECNI = ['start', 'tmbingo', 'pro'];

// Iznos u centima za paket i način plaćanja, ili null ako kombinacija ne postoji.
export function cijena(paket, period) {
  const p = PAKETI[paket];
  if (!p) return null;
  if (p.jednokratno) return period === 'jednokratno' ? p.jednokratno : null;
  return period === 'godisnje' ? p.godisnje : period === 'mjesecno' ? p.mjesecno : null;
}

export const euri = (centi) => (centi / 100).toLocaleString('hr-HR', { minimumFractionDigits: centi % 100 ? 2 : 0 }) + ' €';
