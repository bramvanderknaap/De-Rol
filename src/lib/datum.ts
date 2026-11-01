// Datums zonder tijdzone-gedoe: we rekenen met lokale kalenderdagen.

export type Feestdag = { datum: string; naam: string }

export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dag = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dag}`
}

export function vanIso(s: string): Date {
  const [j, m, d] = s.split('-').map(Number)
  return new Date(j, m - 1, d)
}

export function plusDagen(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + n)
  return r
}

// Paaszondag volgens het algoritme van Meeus/Jones/Butcher (gregoriaanse kalender).
export function paaszondag(jaar: number): Date {
  const a = jaar % 19
  const b = Math.floor(jaar / 100)
  const c = jaar % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const maand = Math.floor((h + l - 7 * m + 114) / 31)
  const dag = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(jaar, maand - 1, dag)
}

// Algemeen erkende feestdagen, art. 3 Algemene termijnenwet (lid 1 en lid 2: Goede Vrijdag).
// Koningsdag: 27 april, of 26 april als 27 april op een zondag valt.
export function feestdagen(jaar: number): Feestdag[] {
  const pasen = paaszondag(jaar)
  const koning = new Date(jaar, 3, 27)
  const koningsdag = koning.getDay() === 0 ? new Date(jaar, 3, 26) : koning
  const lijst: Feestdag[] = [
    { datum: iso(new Date(jaar, 0, 1)), naam: 'Nieuwjaarsdag' },
    { datum: iso(plusDagen(pasen, -2)), naam: 'Goede Vrijdag' },
    { datum: iso(plusDagen(pasen, 1)), naam: 'Tweede Paasdag' },
    { datum: iso(koningsdag), naam: 'Koningsdag' },
    { datum: iso(new Date(jaar, 4, 5)), naam: '5 mei' },
    { datum: iso(plusDagen(pasen, 39)), naam: 'Hemelvaartsdag' },
    { datum: iso(plusDagen(pasen, 50)), naam: 'Tweede Pinksterdag' },
    { datum: iso(new Date(jaar, 11, 25)), naam: 'Eerste Kerstdag' },
    { datum: iso(new Date(jaar, 11, 26)), naam: 'Tweede Kerstdag' },
  ]
  return lijst.sort((x, y) => x.datum.localeCompare(y.datum))
}

export function feestdag(d: Date): Feestdag | undefined {
  const s = iso(d)
  return feestdagen(d.getFullYear()).find((f) => f.datum === s)
}

export function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6
}

export function isWerkdag(d: Date): boolean {
  return !isWeekend(d) && !feestdag(d)
}

// n werkdagen terug (n > 0) of vooruit (n < 0) tellen, de begindag niet meegerekend.
export function werkdagenTerug(d: Date, n: number): Date {
  let r = d
  let geteld = 0
  const stap = n >= 0 ? -1 : 1
  while (geteld < Math.abs(n)) {
    r = plusDagen(r, stap)
    if (isWerkdag(r)) geteld++
  }
  return r
}

export function vorigeWerkdag(d: Date): Date {
  let r = plusDagen(d, -1)
  while (!isWerkdag(r)) r = plusDagen(r, -1)
  return r
}

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

export function dagnaam(d: Date): string {
  return DAGEN[d.getDay()]
}

export function lang(d: Date): string {
  return `${dagnaam(d)} ${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`
}

export function eersteWoensdag(jaar: number, maand: number): Date {
  const d = new Date(jaar, maand, 1)
  while (d.getDay() !== 3) d.setDate(d.getDate() + 1)
  return d
}
