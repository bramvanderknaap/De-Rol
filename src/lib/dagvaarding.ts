// Controle van een dagvaarding op de vormvereisten van art. 45 lid 3 en art. 111-125 Rv
// en art. 1.5 en 3.1 van het Landelijk procesreglement (2e versie, 1 juli 2026).
// Letterlijke wettekst: projectmap de-rol/bronnen/dagvaarding-bronnen.md.
// De controle zoekt of iets er staat, niet of het inhoudelijk klopt.

import { isWerkdag, plusDagen, vorigeWerkdag } from './datum'

export type Zaak = 'handel' | 'kanton'
export type Moment = 'concept' | 'betekend'
export type Woonplaats = 'nl' | 'eu' | 'elders' | 'nl-betekend'

export type Opties = {
  zaak: Zaak
  moment: Moment
  meerGedaagden: boolean
  woonplaats: Woonplaats
  consument: boolean
  verkort: boolean
  gemachtigde: boolean // kanton: eiser procedeert bij gemachtigde (art. 111 lid 2 onder b)
}

export type Uitslag = 'ok' | 'fout' | 'let-op' | 'info'

export type Eis = {
  nr: string
  titel: string
  bron: string
  status: Uitslag
  uitleg?: string
  vindplaats?: { pagina: number; tekst: string }
}

export type Tekst = { tekst: string; begin: number[] } // begin[i] = positie waar pagina i+1 begint

// ---------- tekst ----------

export function maakTekst(paginas: string[]): Tekst {
  const begin: number[] = []
  let tekst = ''
  for (const p of paginas) {
    begin.push(tekst.length)
    const schoon = p.replace(/(\p{L})-\s*\n\s*(\p{Ll})/gu, '$1$2').replace(/\s+/g, ' ').trim()
    tekst += schoon + ' '
  }
  return { tekst, begin }
}

function paginaVan(t: Tekst, i: number): number {
  let p = 0
  while (p + 1 < t.begin.length && t.begin[p + 1] <= i) p++
  return p + 1
}

function fragment(t: Tekst, i: number, lengte: number): string {
  const s = t.tekst
  let a = i
  const ondergrens = Math.max(0, i - 90)
  while (a > ondergrens && !/[.;:]\s/.test(s.slice(a - 2, a))) a--
  // Geen zinsgrens gevonden: begin bij het eerstvolgende hele woord.
  if (a > 0 && a === ondergrens && !/\s/.test(s[a - 1])) while (a < i && !/\s/.test(s[a - 1])) a++
  let b = Math.min(s.length, i + Math.max(lengte, 1))
  const bovengrens = Math.min(s.length, a + 260)
  // Einde van een zin: punt of puntkomma gevolgd door een spatie, maar niet na een voorletter of "B.V."
  const zinseinde = (k: number) => /[.;]/.test(s[k - 1] ?? '') && /\s/.test(s[k] ?? ' ') && !/(^|[\s.])\p{Lu}\.$/u.test(s.slice(Math.max(0, k - 3), k))
  while (b < bovengrens && !zinseinde(b)) b++
  if (b === bovengrens && b < s.length) while (b > i + lengte && !/\s/.test(s[b])) b--
  const kern = s.slice(a, b).trim()
  return (a > 0 ? '… ' : '') + kern + (b < s.length ? ' …' : '')
}

type Vondst = { index: number; lengte: number }

// Zoek een anker; elk patroon uit `ook` moet binnen `venster` tekens van dat anker staan.
function vind(t: Tekst, anker: RegExp, ook: RegExp[] = [], venster = 600): Vondst | undefined {
  const re = new RegExp(anker.source, anker.flags.includes('g') ? anker.flags : anker.flags + 'g')
  for (const m of t.tekst.matchAll(re)) {
    const i = m.index ?? 0
    const omgeving = t.tekst.slice(Math.max(0, i - venster), i + venster)
    if (ook.every((p) => p.test(omgeving))) return { index: i, lengte: m[0].length }
  }
  return undefined
}

// ---------- datums ----------

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
const EENHEDEN = ['', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen']
const TIENTALLEN: Record<number, string> = { 10: 'tien', 11: 'elf', 12: 'twaalf', 13: 'dertien', 14: 'veertien', 15: 'vijftien', 16: 'zestien', 17: 'zeventien', 18: 'achttien', 19: 'negentien' }
const VEELVOUDEN = ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig']

export function getalInWoorden(n: number): string {
  if (n < 10) return EENHEDEN[n]
  if (n < 20) return TIENTALLEN[n]
  const e = n % 10
  const t = VEELVOUDEN[Math.floor(n / 10)]
  if (!e) return t
  const eenheid = EENHEDEN[e]
  return eenheid + (eenheid.endsWith('e') ? 'ën' : 'en') + t
}

export function rangtelwoord(n: number): string {
  if (n === 1) return 'eerste'
  if (n === 3) return 'derde'
  if (n === 8) return 'achtste'
  const w = getalInWoorden(n)
  return n < 20 ? w + 'de' : w + 'ste'
}

const zonderTrema = (s: string) => s.replace(/ë/g, 'e')

// Woord → getal voor 1 t/m 99, hoofd- en rangtelwoorden, met of zonder trema.
const WOORDEN = new Map<string, number>()
for (let n = 1; n < 100; n++) {
  for (const w of [getalInWoorden(n), rangtelwoord(n)]) {
    WOORDEN.set(w, n)
    WOORDEN.set(zonderTrema(w), n)
  }
}
const WOORD_RE = [...WOORDEN.keys()].sort((a, b) => b.length - a.length).join('|')
const MAAND_RE = MAANDEN.join('|')
const DAG_MAAND = new RegExp(`\\b(\\d{1,2}|${WOORD_RE})(?:e|ste|de)?\\s+(${MAAND_RE})\\b`, 'gi')
const NUMERIEK = /\b(\d{1,2})[-./](\d{1,2})[-./](\d{4})\b/g
const JAAR_NA = new RegExp(`^[\\s,]*(?:(\\d{4})|tweeduizend\\s*(${WOORD_RE})?)\\b`, 'i')
const JAAR_VOOR = new RegExp(`jaar\\s+(?:(\\d{4})|tweeduizend\\s*(${WOORD_RE})?)`, 'gi')

function jaarUit(cijfers: string | undefined, woord: string | undefined): number {
  if (cijfers) return Number(cijfers)
  return 2000 + (woord ? WOORDEN.get(woord.toLowerCase()) ?? 0 : 0)
}

export type GevondenDatum = { datum: Date; index: number; lengte: number }

export function vindDatums(tekst: string): GevondenDatum[] {
  const uit: GevondenDatum[] = []
  for (const m of tekst.matchAll(DAG_MAAND)) {
    const i = m.index ?? 0
    const dagTekst = m[1].toLowerCase()
    const dag = /^\d+$/.test(dagTekst) ? Number(dagTekst) : WOORDEN.get(dagTekst)
    const maand = MAANDEN.indexOf(m[2].toLowerCase())
    if (!dag || dag > 31 || maand < 0) continue
    let jaar: number | undefined
    let lengte = m[0].length
    const na = tekst.slice(i + m[0].length, i + m[0].length + 45).match(JAAR_NA)
    if (na) {
      jaar = jaarUit(na[1], na[2])
      lengte += na[0].length
    } else {
      const voor = [...tekst.slice(Math.max(0, i - 120), i).matchAll(JAAR_VOOR)].pop()
      if (voor) jaar = jaarUit(voor[1], voor[2])
    }
    if (!jaar || jaar < 2000) continue
    const datum = new Date(jaar, maand, dag)
    if (datum.getDate() !== dag) continue
    uit.push({ datum, index: i, lengte })
  }
  for (const m of tekst.matchAll(NUMERIEK)) {
    const [d, mnd, j] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const datum = new Date(j, mnd - 1, d)
    if (mnd < 1 || mnd > 12 || datum.getDate() !== d) continue
    uit.push({ datum, index: m.index ?? 0, lengte: m[0].length })
  }
  return uit.sort((a, b) => a.index - b.index)
}

export type Datums = {
  betekening?: GevondenDatum
  roldatum?: GevondenDatum
  uur?: string
}

export function vindKerndatums(t: Tekst): Datums {
  const s = t.tekst
  const alle = vindDatums(s)
  const betekening = alle.find((d) => /(heden|het jaar|op de datum)\b/i.test(s.slice(Math.max(0, d.index - 140), d.index)))
  const kandidaten = alle.filter((d) => d !== betekening)
  const metUur = (d: GevondenDatum) => s.slice(d.index + d.lengte, d.index + d.lengte + 70).match(/\b(?:om|te)\s+(\d{1,2}[.:]\d{2})\s*uur/i)
  const roldatum =
    kandidaten.find((d) => metUur(d) && /(verschijnen|terechtzitting|zitting|roldatum|rolzitting|rol)/i.test(s.slice(Math.max(0, d.index - 400), d.index + 120))) ??
    kandidaten.find((d) => /(roldatum|rolzitting|terechtzitting|te verschijnen)/i.test(s.slice(Math.max(0, d.index - 250), d.index)))
  const uur = roldatum ? metUur(roldatum)?.[1].replace(':', '.') : undefined
  return { betekening, roldatum, uur }
}

// ---------- herkennen van de antwoorden op de vragen ----------

export function herken(t: Tekst): Partial<Opties> {
  const s = t.tekst
  const uit: Partial<Opties> = {}
  if (/rechtbank[^.]{0,80}\b(kanton|kantonrechter|team kanton|sector kanton)\b|\bkantonrechter\b/i.test(s)) uit.zaak = 'kanton'
  else if (/\b(team|kamer|afdeling|sector) (handel|civiel)|handelszaken|handelskamer/i.test(s)) uit.zaak = 'handel'
  if (/\bgedaagden\b|gedaagde\s*(sub\s*)?2\b|\bsub\s*2\b/i.test(s)) uit.meerGedaagden = true
  if (/2020\/1784|betekeningsverordening|betekeningsverdrag|verdrag inzake de betekening/i.test(s)) uit.woonplaats = 'eu'
  if (/\bconsument|informatieplicht|afdeling 2B/i.test(s)) uit.consument = true
  if (/verkort(e|ing)?\b[^.]{0,80}termijn|termijn[^.]{0,80}verkort|verlof tot verkorting/i.test(s)) uit.verkort = true
  if (/\bgemachtigde\b/i.test(s) && !/advocaat/i.test(s.slice(0, 3000))) uit.gemachtigde = true
  return uit
}

// ---------- de eisen ----------

const POSTCODE = /\b\d{4}\s?[A-Z]{2}\b/
const WONEND = /(wonende|woonachtig|gevestigd|kantoorhoudende|kantoor houdende|verblijvende|zetelende|domicilie) (te|aan|in|op)\b/i
const RECHTBANKEN = /rechtbank\s+(Amsterdam|Den Haag|'s-Gravenhage|Gelderland|Limburg|Midden-Nederland|Noord-Holland|Noord-Nederland|Oost-Brabant|Overijssel|Rotterdam|Zeeland-West-Brabant)/i

type Regel = {
  nr: string
  titel: string
  bron: string
  geldt: (o: Opties) => boolean
  // waar de deurwaarder het pas invult: bij een concept overslaan
  deurwaarder?: boolean
  zoek: (t: Tekst, o: Opties) => Vondst | undefined
  ontbreekt: Uitslag
  uitleg: string
}

const EXPLOOT = 'Gebrek in het exploot. Nietig alleen als de gedaagde daardoor onredelijk is benadeeld (art. 66 lid 1 Rv); herstel kan bij exploot (art. 66 lid 2). Zie ook art. 120 lid 1 Rv.'
const NIETIG = 'Op straffe van nietigheid (art. 120 lid 1 Rv). Herstel kan bij exploot, uitgebracht vóór de roldatum (art. 120 lid 2).'

export const REGELS: Regel[] = [
  {
    nr: '1', titel: 'Datum van betekening', bron: 'Art. 45 lid 3 onder a Rv', deurwaarder: true, geldt: () => true, ontbreekt: 'fout', uitleg: EXPLOOT,
    zoek: (t) => {
      const d = vindKerndatums(t).betekening
      return d && { index: d.index, lengte: d.lengte }
    },
  },
  {
    nr: '2', titel: 'Naam en woonplaats van de eiser', bron: 'Art. 45 lid 3 onder b Rv', geldt: () => true, ontbreekt: 'fout', uitleg: EXPLOOT + ' Bij een natuurlijk persoon ook de voornamen.',
    zoek: (t) => vind(t, /(op|ten) verzoeke? van|ten verzoeke van|op verzoek van/i, [WONEND], 500),
  },
  {
    nr: '3', titel: 'Voornamen, naam en kantooradres van de deurwaarder', bron: 'Art. 45 lid 3 onder c Rv', deurwaarder: true, geldt: () => true, ontbreekt: 'fout', uitleg: EXPLOOT,
    zoek: (t) => vind(t, /(kandidaat-)?gerechtsdeurwaarder/i, [POSTCODE], 300),
  },
  {
    nr: '4', titel: 'Naam en woonplaats van de gedaagde', bron: 'Art. 45 lid 3 onder d Rv', geldt: () => true, ontbreekt: 'fout', uitleg: EXPLOOT,
    zoek: (t) => vind(t, /\baan\s*:|\bgedagvaard\b|\bgedaagde\b/i, [WONEND], 400),
  },
  {
    nr: '5', titel: 'Aan wie het afschrift is gelaten, met hoedanigheid', bron: 'Art. 45 lid 3 onder e Rv', deurwaarder: true, geldt: () => true, ontbreekt: 'fout', uitleg: EXPLOOT,
    zoek: (t) => vind(t, /mijn exploot doende|afschrift (dezes |van dit exploot )?(achter)?gelaten|gelaten aan|in gesloten envelop|in persoon\b/i),
  },
  {
    nr: '6', titel: 'Handtekening van de deurwaarder', bron: 'Art. 45 lid 5 Rv', deurwaarder: true, geldt: () => true, ontbreekt: 'let-op', uitleg: 'Een handtekening is niet uit de tekst te lezen. Controleer het origineel.',
    zoek: () => undefined,
  },
  {
    nr: '7', titel: 'Gekozen woonplaats van de eiser in Nederland', bron: 'Art. 111 lid 2 onder a Rv', geldt: () => true, ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => vind(t, /woonplaats\s+(kiest|gekozen|te kiezen|koos)|(kiest|kiezende|gekozen)\s+(woonplaats|domicilie)|domicilie kiest/i),
  },
  {
    nr: '8', titel: 'Naam en kantooradres van de advocaat van de eiser', bron: 'Art. 111 lid 2 onder c Rv', geldt: (o) => o.zaak === 'handel', ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => vind(t, /\badvocaat\b/i, [/\bmr\.?\s|meester\s/i, POSTCODE], 400),
  },
  {
    nr: '8', titel: 'Naam en adres van de gemachtigde van de eiser', bron: 'Art. 111 lid 2 onder b Rv', geldt: (o) => o.zaak === 'kanton' && o.gemachtigde, ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => vind(t, /\bgemachtigde\b/i, [POSTCODE], 400),
  },
  {
    nr: '9', titel: 'De eis en de gronden', bron: 'Art. 111 lid 2 onder d Rv', geldt: () => true, ontbreekt: 'fout', uitleg: NIETIG + ' De checker ziet alleen of er een eis staat, niet of de gronden die dragen.',
    zoek: (t) => (t.tekst.length > 1500 ? vind(t, /te veroordelen|veroordeelt\b|voor recht (te )?verklar|verklaring voor recht|te ontbinden|ontbonden te verklaren|te vernietigen|vernietigd te verklaren/i) : undefined),
  },
  {
    nr: '10', titel: 'Rechtbank en adres van de zittingsplaats', bron: 'Art. 111 lid 2 onder e Rv', geldt: () => true, ontbreekt: 'fout', uitleg: NIETIG + ' Zit de zaak in een zittingsplaats waar geen stukken kunnen worden ingediend, dan ook het adres voor stukken.',
    zoek: (t) => vind(t, RECHTBANKEN, [/zittingsplaats|locatie|gebouw|zitting houdende|zittinghoudende/i, POSTCODE], 400),
  },
  {
    nr: '11', titel: 'Roldatum, met het uur als er dan zitting is', bron: 'Art. 111 lid 2 onder f Rv', geldt: () => true, ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => {
      const d = vindKerndatums(t).roldatum
      return d && { index: d.index, lengte: d.lengte }
    },
  },
  {
    nr: '12', titel: 'Verschijnen vertegenwoordigd door een advocaat', bron: 'Art. 111 lid 2 onder h Rv', geldt: (o) => o.zaak === 'handel', ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => vind(t, /advocaat te stellen|advocaat moet stellen|advocaat stelt|vertegenwoordigd door een advocaat|bij advocaat|door (tussenkomst van )?een advocaat/i),
  },
  {
    nr: '12', titel: 'Wijze van verschijnen (in persoon of door gemachtigde) en van antwoorden', bron: 'Art. 111 lid 2 onder g Rv, met art. 82 lid 1 en 2', geldt: (o) => o.zaak === 'kanton', ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => {
      const ook = [/gemachtigde/i, /(verschijnen|verschijning)/i, /(schriftelijk|mondeling)/i, /(antwoord|conclusie|akte)/i]
      return vind(t, /(kunt|kan|mag|moet|zelf)[^.]{0,40}in persoon|in persoon (te )?(verschijnen|procederen)/i, ook, 900) ?? vind(t, /in persoon/i, ook, 900)
    },
  },
  {
    nr: '13', titel: 'Verstek bij niet verschijnen of griffierecht te laat (art. 139)', bron: 'Art. 111 lid 2 onder i Rv', geldt: () => true, ontbreekt: 'fout', uitleg: NIETIG + ' In kantonzaken hoeft het griffierecht hier niet te worden genoemd.',
    zoek: (t, o) => vind(t, /\bverstek\b/i, o.zaak === 'handel' ? [/griffierecht/i, /(niet )?tijdig|binnen (de )?termijn/i] : [], 700),
  },
  {
    nr: '14', titel: 'Griffierecht: heffing, betalingstermijn, vindplaats van de tabel en regeling voor onvermogenden', bron: 'Art. 111 lid 2 onder k Rv', geldt: () => true, ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => vind(t, /griffierecht/i, [/wet griffierechten burgerlijke zaken/i, /onvermogend/i, /(termijn|binnen (vier|4|twee|2) weken)/i, /(rechtspraak\.nl|bijlage|vindplaats|www\.)/i], 1500),
  },
  {
    nr: '15', titel: 'Plicht van art. 21 en gevolg van art. 149 bij niet of onvoldoende betwisten', bron: 'Art. 111 lid 2 onder m Rv', geldt: () => true, ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => vind(t, /(artikel|art\.)\s*21\b|volledig en naar waarheid/i, [/(artikel|art\.)\s*149\b|niet of (niet )?onvoldoende (wordt |worden |is |zijn )?betwist|als vaststaand/i], 900),
  },
  {
    nr: '16', titel: 'Bij meer gedaagden: één vonnis, als vonnis op tegenspraak (art. 140 lid 3)', bron: 'Art. 111 lid 2 onder j Rv', geldt: (o) => o.meerGedaagden, ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => vind(t, /(één|een) vonnis/i, [/tegenspraak/i], 300),
  },
  {
    nr: '17', titel: 'Bij meer gedaagden: eenmaal griffierecht bij dezelfde advocaat (art. 15 Wgbz)', bron: 'Art. 111 lid 2 onder l Rv', geldt: (o) => o.meerGedaagden, ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => vind(t, /(artikel|art\.)\s*15\b[^.]{0,120}griffierecht|gezamenlijk griffierecht|slechts eenmaal|eenmaal (een )?(gezamenlijk )?griffierecht/i),
  },
  {
    nr: '18', titel: 'Verweren van de gedaagde, bewijsmiddelen en getuigen', bron: 'Art. 111 lid 3 Rv', geldt: () => true, ontbreekt: 'let-op', uitleg: 'Geen nietigheid; de rechter kan er de gevolgtrekking aan verbinden die hij geraden acht (art. 120 lid 4 Rv).',
    zoek: (t) => vind(t, /\bverweer|\bverweren\b|heeft (zich )?verweerd/i, [/bewijs|getuige/i], 2500) ?? vind(t, /betwist/i, [/bewijs|getuige/i], 2500),
  },
  {
    nr: '19', titel: 'Consumentenzaak: standpunt over de sanctie bij schending van informatieplichten', bron: 'Art. 3.1 onder j procesreglement', geldt: (o) => o.consument, ontbreekt: 'let-op', uitleg: 'Herstel verzuim is hiervoor niet mogelijk (art. 3.2 procesreglement). Ook moeten de algemene voorwaarden als productie worden overgelegd.',
    zoek: (t) => vind(t, /informatieplicht/i, [/sanctie/i], 800),
  },
  {
    nr: '20', titel: 'Beschikking tot verkorting van de termijn aan het hoofd van het exploot', bron: 'Art. 117 Rv', geldt: (o) => o.verkort, ontbreekt: 'fout', uitleg: NIETIG,
    zoek: (t) => {
      const v = vind(t, /verkort|verkorting|verlof/i, [/(voorzieningenrechter|kantonrechter)/i], 400)
      return v && v.index < 2500 ? v : undefined
    },
  },
]

export function controleer(t: Tekst, o: Opties): Eis[] {
  const uit: Eis[] = []
  for (const r of REGELS) {
    if (!r.geldt(o)) continue
    if (r.deurwaarder && o.moment === 'concept') continue
    const v = r.zoek(t, o)
    if (v) {
      uit.push({ nr: r.nr, titel: r.titel, bron: r.bron, status: 'ok', vindplaats: { pagina: paginaVan(t, v.index), tekst: fragment(t, v.index, v.lengte) } })
    } else {
      uit.push({ nr: r.nr, titel: r.titel, bron: r.bron, status: r.ontbreekt, uitleg: r.uitleg })
    }
  }
  return uit
}

// ---------- termijnen ----------

function plusMaanden(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth() + n, d.getDate())
  // 31 januari + 1 maand: laatste dag van februari
  if (r.getDate() !== d.getDate()) r.setDate(0)
  return r
}

export const TERMIJN: Record<Woonplaats, { tekst: string; bron: string }> = {
  nl: { tekst: 'ten minste een week', bron: 'Art. 114 Rv' },
  'nl-betekend': { tekst: 'ten minste een week', bron: 'Art. 115 lid 3 Rv' },
  eu: { tekst: 'ten minste vier weken', bron: 'Art. 115 lid 1 Rv' },
  elders: { tekst: 'ten minste drie maanden', bron: 'Art. 115 lid 2 Rv' },
}

// Laatste dag van de minimale termijn. De termijn begint op de dag na het exploot (art. 119 lid 1).
// Voorzichtige lezing: valt die dag op een weekend of feestdag, dan verlengd tot de volgende werkdag (art. 1 lid 1 Atw),
// en zo nodig verder tot er twee werkdagen in de termijn vallen (art. 2 Atw).
export function eindeTermijn(betekening: Date, w: Woonplaats): Date {
  let einde = w === 'eu' ? plusDagen(betekening, 28) : w === 'elders' ? plusMaanden(betekening, 3) : plusDagen(betekening, 7)
  while (!isWerkdag(einde)) einde = plusDagen(einde, 1)
  // Art. 2 Atw: in de termijn moeten ten minste twee werkdagen vallen.
  const werkdagen = () => { let n = 0; for (let d = plusDagen(betekening, 1); d <= einde; d = plusDagen(d, 1)) if (isWerkdag(d)) n++; return n }
  while (werkdagen() < 2) einde = plusDagen(einde, 1)
  return einde
}

// De roldatum telt niet mee (art. 119 lid 2): de vroegste roldatum is de dag na het einde.
export function vroegsteRoldatum(betekening: Date, w: Woonplaats): Date {
  return plusDagen(eindeTermijn(betekening, w), 1)
}

export function uitersteBetekening(roldatum: Date, w: Woonplaats): Date {
  let b = plusDagen(roldatum, -1)
  while (vroegsteRoldatum(b, w) > roldatum) b = plusDagen(b, -1)
  return b
}

// Uiterlijk op de laatste dag dat de griffie open is vóór de roldatum (art. 125 lid 2 Rv, art. 3.1 procesreglement).
export function uitersteIndiening(roldatum: Date): Date {
  return vorigeWerkdag(roldatum)
}
