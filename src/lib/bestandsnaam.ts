import type { Bevinding } from './types'

export type Partij = 'EIS' | 'GED'

export type Productienaam = {
  partij: string // "EIS", "GED", "GED1-3" …
  nummer: number
  omschrijving: string
  deel?: number
}

// Bijlage II (10.2.2): "EIS – productie 1 – koopovereenkomst", "GED – productie 1 – …",
// bij een deel van de gedaagden "GED1-3 – productie 1 – …". Te grote documenten: "deel 1, deel 2".
const PRODUCTIE = /^(EIS|GED[0-9][0-9,\- ]*|GED)\s*[–-]\s*productie\s+(\d+)\s*[–-]\s*(.+)$/i
const DEEL = /\bdeel\s+(\d+)\b/i

export function leesProductienaam(naam: string): Productienaam | null {
  const zonder = naam.replace(/\.pdf$/i, '').trim()
  const m = zonder.match(PRODUCTIE)
  if (!m) return null
  const deel = m[3].match(DEEL)
  return {
    partij: m[1].toUpperCase().replace(/\s+/g, ''),
    nummer: Number(m[2]),
    omschrijving: m[3].trim(),
    deel: deel ? Number(deel[1]) : undefined,
  }
}

export function lijktProductie(naam: string): boolean {
  return /productie/i.test(naam)
}

// Rechtspraak, veelgestelde vragen digitaal procederen: geen diacritische tekens (accenten en symbolen)
// in de namen, anders lukt het uploaden niet. Het eigen voorbeeld van de Rechtspraak gebruikt een
// gedachtestreepje (–), dus dat staat hier toe.
const TOEGESTAAN = /[A-Za-z0-9 ._\-–]/

export function controleerBestandsnaam(naam: string): Bevinding[] {
  const uit: Bevinding[] = []
  const basis = naam.replace(/\.pdf$/i, '')
  if (!/\.pdf$/i.test(naam)) {
    uit.push({
      status: 'fout',
      titel: 'Geen pdf-bestand',
      uitleg: 'Mijn Rechtspraak accepteert alleen pdf/a-bestanden.',
      bron: 'Art. 2.6, voetnoot 2',
    })
  }
  const accenten = [...new Set([...basis].filter((t) => /\p{L}/u.test(t) && !/[A-Za-z]/.test(t)))]
  const symbolen = [...new Set([...basis].filter((t) => !/\p{L}/u.test(t) && !TOEGESTAAN.test(t)))]
  if (accenten.length) {
    uit.push({
      status: 'fout',
      titel: 'Letters met accent in de naam',
      uitleg: `Vervang ${accenten.map((t) => `"${t}"`).join(', ')}. Met accenten lukt het uploaden niet.`,
      bron: 'Rechtspraak, veelgestelde vragen digitaal procederen',
    })
  }
  if (symbolen.length) {
    uit.push({
      status: 'fout',
      titel: 'Symbolen in de naam',
      uitleg: `Haal ${symbolen.map((t) => `"${t}"`).join(', ')} weg. Gebruik alleen letters, cijfers, spaties en streepjes.`,
      bron: 'Rechtspraak, veelgestelde vragen digitaal procederen',
    })
  }
  if (!accenten.length && !symbolen.length && /\.pdf$/i.test(naam)) {
    uit.push({ status: 'ok', titel: 'Bestandsnaam zonder accenten of symbolen', bron: 'Rechtspraak, veelgestelde vragen digitaal procederen' })
  }
  if (lijktProductie(naam)) {
    if (leesProductienaam(naam)) {
      uit.push({ status: 'ok', titel: 'Naam volgt het voorbeeld uit bijlage II', bron: 'Bijlage II, 10.2.2' })
    } else {
      uit.push({
        status: 'let-op',
        titel: 'Naam wijkt af van het voorbeeld',
        uitleg: 'Bijlage II geeft als voorbeeld "EIS – productie 1 – koopovereenkomst" of "GED – productie 1 – …".',
        bron: 'Bijlage II, 10.2.2',
      })
    }
  }
  return uit
}

export type Nummering = { partij: string; ontbreekt: number[]; dubbel: number[]; hoogste: number }

// Art. 2.14: iedere partij hanteert een eigen doorlopende nummering.
export function controleerNummering(namen: Productienaam[]): Nummering[] {
  const perPartij = new Map<string, Productienaam[]>()
  for (const n of namen) {
    const lijst = perPartij.get(n.partij) ?? []
    lijst.push(n)
    perPartij.set(n.partij, lijst)
  }
  const uit: Nummering[] = []
  for (const [partij, lijst] of perPartij) {
    const tellers = new Map<number, number>()
    for (const n of lijst) if (!n.deel || n.deel === 1) tellers.set(n.nummer, (tellers.get(n.nummer) ?? 0) + 1)
    for (const n of lijst) if (n.deel && !tellers.has(n.nummer)) tellers.set(n.nummer, 1)
    const hoogste = Math.max(...lijst.map((n) => n.nummer))
    const ontbreekt: number[] = []
    for (let i = 1; i <= hoogste; i++) if (!tellers.has(i)) ontbreekt.push(i)
    const dubbel = [...tellers].filter(([, k]) => k > 1).map(([n]) => n)
    uit.push({ partij, ontbreekt, dubbel, hoogste })
  }
  return uit.sort((a, b) => a.partij.localeCompare(b.partij))
}
