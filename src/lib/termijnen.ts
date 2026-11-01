import { dagnaam, eersteWoensdag, feestdag, isWeekend, lang, plusDagen, vorigeWerkdag, werkdagenTerug } from './datum'

export type Groep = 'Rol' | 'Mondelinge behandeling' | 'Griffierecht' | 'Parkeerrol'

export type Uitkomst = {
  datum: Date
  wat: string // korte omschrijving van de uitkomst, bijv. "Conclusie van antwoord uiterlijk"
  signalen: string[]
}

export type Termijn = {
  id: string
  groep: Groep
  naam: string
  invoer: string // label van het datumveld
  invoerMoetWoensdag?: boolean
  artikel: string
  citaat: string
  toelichting?: string
  bereken: (d: Date) => Uitkomst[]
}

function signalenVoor(d: Date, roldag: boolean): string[] {
  const s: string[] = []
  const f = feestdag(d)
  if (f) {
    s.push(
      roldag
        ? `Valt op ${f.naam}. Op een algemeen erkende feestdag is er geen roldag (voetnoot bij art. 1.5). Kijk in de rolkalender van de rechtbank welke roldatum geldt.`
        : `Valt op ${f.naam}. De griffie is dan dicht.`,
    )
  } else if (isWeekend(d)) {
    s.push(`Valt op een ${dagnaam(d)}. De griffie is dan dicht.`)
  }
  return s
}

function vooruitWeken(weken: number, wat: string) {
  return (d: Date): Uitkomst[] => {
    const datum = plusDagen(d, weken * 7)
    return [{ datum, wat, signalen: signalenVoor(datum, true) }]
  }
}

// Terugrekenen: de Algemene termijnenwet verlengt zulke termijnen niet (art. 1 lid 2 Atw).
function terug(dagen: number, wat: string) {
  return (d: Date): Uitkomst[] => {
    const datum = plusDagen(d, -dagen)
    const s = signalenVoor(datum, false)
    if (s.length) s.push(`Veilig is de werkdag ervoor: ${lang(vorigeWerkdag(datum))}.`)
    return [{ datum, wat, signalen: s }]
  }
}

export const TERMIJNEN: Termijn[] = [
  {
    id: 'dagvaarding',
    groep: 'Rol',
    naam: 'Dagvaarding indienen',
    invoer: 'Roldatum in de dagvaarding',
    invoerMoetWoensdag: true,
    artikel: 'Art. 1.5 en 3.1',
    citaat: 'uiterlijk op de laatste dag voorafgaand aan de in de dagvaarding vermelde roldatum',
    toelichting: 'Volgens de voetnoot bij art. 3.1 is dat de laatste dag dat de griffie open is, tot 24:00 uur. Hier is aangenomen dat de griffie op werkdagen open is.',
    bereken: (d) => [{ datum: vorigeWerkdag(d), wat: 'Dagvaarding uiterlijk binnen op', signalen: [] }],
  },
  {
    id: 'cva',
    groep: 'Rol',
    naam: 'Conclusie van antwoord',
    invoer: 'Roldatum waarop de gedaagde verschijnt',
    invoerMoetWoensdag: true,
    artikel: 'Art. 2.23 en 4.4',
    citaat: 'Als de gedaagde in het geding verschijnt, wordt de zaak verwezen naar de rol van zes weken later voor conclusie van antwoord.',
    toelichting: 'Indienen uiterlijk op die roldag om 10.00 uur (art. 1.5).',
    bereken: vooruitWeken(6, 'Roldatum conclusie van antwoord'),
  },
  {
    id: 'cva-tussenvonnis',
    groep: 'Rol',
    naam: 'Conclusie na inhoudelijk tussenvonnis',
    invoer: 'Roldatum van de verwijzing',
    invoerMoetWoensdag: true,
    artikel: 'Art. 2.23',
    citaat: 'zodra in de procedure een inhoudelijk tussenvonnis is gewezen, vier weken',
    toelichting: 'Indienen uiterlijk op die roldag om 10.00 uur (art. 1.5).',
    bereken: vooruitWeken(4, 'Roldatum conclusie'),
  },
  {
    id: 'akte',
    groep: 'Rol',
    naam: 'Akte',
    invoer: 'Roldatum van de verwijzing',
    invoerMoetWoensdag: true,
    artikel: 'Art. 2.23',
    citaat: 'De termijn voor het indienen van een akte bedraagt twee weken.',
    toelichting: 'Indienen uiterlijk op die roldag om 10.00 uur (art. 1.5).',
    bereken: vooruitWeken(2, 'Roldatum akte'),
  },
  {
    id: 'incident',
    groep: 'Rol',
    naam: 'Conclusie van antwoord in het incident',
    invoer: 'Roldatum van de verwijzing',
    invoerMoetWoensdag: true,
    artikel: 'Art. 2.23',
    citaat: 'twee weken',
    toelichting: 'Indienen uiterlijk op die roldag om 10.00 uur (art. 1.5).',
    bereken: vooruitWeken(2, 'Roldatum conclusie in het incident'),
  },
  {
    id: 'uitstel',
    groep: 'Rol',
    naam: 'Uitstel vragen om klemmende reden',
    invoer: 'Roldatum waarvoor uitstel nodig is',
    invoerMoetWoensdag: true,
    artikel: 'Art. 2.24',
    citaat: 'uiterlijk vier werkdagen vóór de roldatum',
    toelichting: 'De wederpartij kan binnen twee werkdagen reageren. Een eerste eenstemmig verzoek van partijen wordt ingewilligd; daarvoor geldt deze termijn niet.',
    bereken: (d) => [{ datum: werkdagenTerug(d, 4), wat: 'Verzoek uiterlijk indienen op', signalen: [] }],
  },
  {
    id: 'griffierecht-eiser',
    groep: 'Griffierecht',
    naam: 'Griffierecht eiser',
    invoer: 'Eerste roldatum',
    invoerMoetWoensdag: true,
    artikel: 'Art. 4.1',
    citaat: 'binnen vier weken nadien',
    toelichting: 'Niet tijdig betaald: ontslag van instantie op de eerstvolgende roldatum (art. 4.4).',
    bereken: (d) => {
      const datum = plusDagen(d, 28)
      return [{ datum, wat: 'Griffierecht uiterlijk betaald op', signalen: signalenVoor(datum, false) }]
    },
  },
  {
    id: 'griffierecht-gedaagde',
    groep: 'Griffierecht',
    naam: 'Griffierecht gedaagde',
    invoer: 'Roldatum waarop de gedaagde verschijnt',
    invoerMoetWoensdag: true,
    artikel: 'Art. 4.2',
    citaat: 'vanaf zijn verschijning in het geding … binnen vier weken nadien',
    bereken: (d) => {
      const datum = plusDagen(d, 28)
      return [{ datum, wat: 'Griffierecht uiterlijk betaald op', signalen: signalenVoor(datum, false) }]
    },
  },
  {
    id: 'mb-stukken',
    groep: 'Mondelinge behandeling',
    naam: 'Stukken voor de mondelinge behandeling',
    invoer: 'Datum mondelinge behandeling',
    artikel: 'Art. 5.7 (art. 87 lid 6 Rv)',
    citaat: 'uiterlijk binnen tien kalenderdagen voor mondelinge behandeling',
    toelichting: 'Later ingediende stukken worden buiten beschouwing gelaten, tenzij de rechter anders beslist. Omvangrijke stukken vlak voor deze termijn kunnen ook buiten beschouwing blijven.',
    bereken: terug(10, 'Stukken uiterlijk bij rechter en wederpartij op'),
  },
  {
    id: 'mb-tolk',
    groep: 'Mondelinge behandeling',
    naam: 'Tolk melden',
    invoer: 'Datum mondelinge behandeling',
    artikel: 'Art. 5.11',
    citaat: 'uiterlijk tien werkdagen voorafgaand aan de mondelinge behandeling',
    bereken: (d) => [{ datum: werkdagenTerug(d, 10), wat: 'Tolk uiterlijk melden op', signalen: [] }],
  },
  {
    id: 'mb-gedetineerde',
    groep: 'Mondelinge behandeling',
    naam: 'Gedetineerde partij melden',
    invoer: 'Datum mondelinge behandeling',
    artikel: 'Art. 5.10',
    citaat: 'uiterlijk twee weken voor de mondelinge behandeling',
    toelichting: 'Met voor- en achternamen, geboortedatum en verblijfplaats.',
    bereken: terug(14, 'Uiterlijk melden op'),
  },
  {
    id: 'mb-andere-datum',
    groep: 'Mondelinge behandeling',
    naam: 'Andere datum om klemmende reden',
    invoer: 'Datum mondelinge behandeling',
    artikel: 'Art. 5.5',
    citaat: 'uiterlijk een week voor de datum van de mondelinge behandeling',
    bereken: terug(7, 'Verzoek uiterlijk op'),
  },
  {
    id: 'mb-na-dagbepaling',
    groep: 'Mondelinge behandeling',
    naam: 'Meer zittingstijd, getuigen of partijdeskundigen',
    invoer: 'Datum waarop dag en uur zijn bepaald',
    artikel: 'Art. 5.6 en 5.8',
    citaat: 'uiterlijk binnen een week nadat de dag en het uur van de mondelinge behandeling zijn bepaald',
    bereken: (d) => {
      const datum = plusDagen(d, 7)
      return [{ datum, wat: 'Verzoek of bericht uiterlijk op', signalen: signalenVoor(datum, false) }]
    },
  },
  {
    id: 'parkeerrol',
    groep: 'Parkeerrol',
    naam: 'Parkeerrol',
    invoer: 'Datum van verwijzing naar de parkeerrol',
    artikel: 'Art. 8.2.4 en 8.2.5',
    citaat: 'uiterlijk vier werkdagen voorafgaande aan de roldatum',
    toelichting: 'Januari tot en met juni: parkeerrol op de eerste roldatum in oktober van hetzelfde jaar. Juli tot en met december: eerste roldatum in april van het jaar erna. Geen bericht met B-formulier: ambtshalve doorhaling.',
    bereken: (d) => {
      const voorjaar = d.getMonth() <= 5
      const rol = voorjaar ? eersteWoensdag(d.getFullYear(), 9) : eersteWoensdag(d.getFullYear() + 1, 3)
      return [
        { datum: rol, wat: 'Zaak staat op de parkeerrol van', signalen: signalenVoor(rol, true) },
        { datum: werkdagenTerug(rol, 4), wat: 'Bericht met B-formulier uiterlijk op', signalen: [] },
      ]
    },
  },
]
