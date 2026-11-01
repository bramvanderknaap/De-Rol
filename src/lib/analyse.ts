import * as pdfjs from 'pdfjs-dist'
import werker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Bevinding, Soort } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = werker

// Bron: Rechtspraak, digitaal procederen dagvaardingszaken handel: "Een bestand kan tot 25 MB groot zijn."
// Of MB hier 1.000.000 of 1.048.576 bytes is, zegt de bron niet. Daarom: tussen die twee een waarschuwing.
const MB_DECIMAAL = 25 * 1000 * 1000
const MB_BINAIR = 25 * 1024 * 1024

const PT_PER_CM = 72 / 2.54
const A4 = { b: 595.28, h: 841.89 }
const MARGE_PT = 2.5 * PT_PER_CM
const MARGE_SPELING_PT = 3 // meetonzekerheid van ongeveer 1 mm

export type Analyse = {
  paginas: number
  bevindingen: Bevinding[]
  tekstPerPagina: string[]
}

type Regel = { y: number; x0: number; x1: number; grootte: number; tekst: string }

function cm(pt: number): string {
  return (pt / PT_PER_CM).toFixed(1).replace('.', ',')
}

function mb(bytes: number): string {
  return (bytes / 1000 / 1000).toFixed(1).replace('.', ',')
}

function zoekInBytes(buf: ArrayBuffer): { pdfa?: { deel: string; niveau?: string }; versleuteld: boolean } {
  // Latin-1 houdt elke byte één teken, zodat we in de ruwe pdf kunnen zoeken.
  const tekst = new TextDecoder('latin1').decode(buf)
  const deel = tekst.match(/pdfaid:part(?:\s*=\s*["']|\s*>\s*)(\d)/)
  const niveau = tekst.match(/pdfaid:conformance(?:\s*=\s*["']|\s*>\s*)([A-Za-z])/)
  const versleuteld = /\/Encrypt\s+(\d+\s+\d+\s+R|<<)/.test(tekst)
  return { pdfa: deel ? { deel: deel[1], niveau: niveau?.[1]?.toUpperCase() } : undefined, versleuteld }
}

function regelsVan(items: { str: string; transform: number[]; width: number }[]): Regel[] {
  const perY = new Map<number, Regel>()
  for (const it of items) {
    if (!it.str.trim()) continue
    const [a, b, c, d, e, f] = it.transform
    if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) continue // gedraaide tekst niet meten
    const grootte = Math.hypot(c, d) || Math.abs(a)
    const y = Math.round(f * 2) / 2
    const r = perY.get(y)
    if (r) {
      r.x0 = Math.min(r.x0, e)
      r.x1 = Math.max(r.x1, e + it.width)
      r.tekst += it.str
      if (it.str.trim().length > 3) r.grootte = Math.max(r.grootte, grootte)
    } else {
      perY.set(y, { y, x0: e, x1: e + it.width, grootte, tekst: it.str })
    }
  }
  return [...perY.values()].sort((p, q) => q.y - p.y)
}

function modus(waarden: { v: number; gewicht: number }[]): number | undefined {
  const tel = new Map<number, number>()
  for (const { v, gewicht } of waarden) {
    const k = Math.round(v * 2) / 2
    tel.set(k, (tel.get(k) ?? 0) + gewicht)
  }
  let beste: number | undefined
  let max = 0
  for (const [k, n] of tel) if (n > max) [beste, max] = [k, n]
  return beste
}

function mediaan(xs: number[]): number | undefined {
  if (!xs.length) return undefined
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const KOP = /^((\d+(\.\d+)*\.?)|([IVXLC]+\.)|([A-Z]\.))\s+\S/

export async function analyseer(bestand: File, soort: Soort): Promise<Analyse> {
  const bevindingen: Bevinding[] = []
  const buf = await bestand.arrayBuffer()

  // 1. Bestandsgrootte
  if (bestand.size > MB_BINAIR) {
    bevindingen.push({
      status: 'fout',
      titel: `Te groot: ${mb(bestand.size)} MB`,
      uitleg: 'Een bestand mag tot 25 MB zijn. Splits het en upload de delen als "deel 1", "deel 2".',
      bron: 'Art. 2.6, voetnoot 2 en bijlage II, 10.2.2',
    })
  } else if (bestand.size > MB_DECIMAAL) {
    bevindingen.push({
      status: 'let-op',
      titel: `Op de grens: ${mb(bestand.size)} MB`,
      uitleg: 'De bron zegt niet of 25 MB 25.000.000 of 26.214.400 bytes is. Splits het bestand voor de zekerheid.',
      bron: 'Art. 2.6, voetnoot 2',
    })
  } else {
    bevindingen.push({ status: 'ok', titel: 'Kleiner dan 25 MB', bron: 'Art. 2.6, voetnoot 2' })
  }

  // 2. PDF/A-verklaring en versleuteling uit de ruwe bytes
  const ruw = zoekInBytes(buf)
  if (ruw.pdfa) {
    bevindingen.push({
      status: 'ok',
      titel: `Verklaart PDF/A-${ruw.pdfa.deel}${ruw.pdfa.niveau?.toLowerCase() ?? ''}`,
      uitleg: 'Het bestand zegt zelf dat het PDF/A is. Een volledige validatie (zoals met veraPDF) doet deze controle niet.',
      bron: 'Art. 2.6, voetnoot 2',
    })
  } else {
    bevindingen.push({
      status: 'fout',
      titel: 'Geen PDF/A',
      uitleg: 'Er staat geen PDF/A-verklaring in het bestand. Sla het opnieuw op als PDF/A. In Word kan dat bij het opslaan als pdf, onder Opties.',
      bron: 'Art. 2.6, voetnoot 2',
    })
  }
  if (ruw.versleuteld) {
    bevindingen.push({
      status: 'fout',
      titel: 'Beveiligd bestand',
      uitleg: 'Bestanden mogen niet beveiligd zijn, bijvoorbeeld met een wachtwoord.',
      bron: 'Rechtspraak, digitaal procederen dagvaardingszaken handel',
    })
  }

  // 3. Openen
  let doc: pdfjs.PDFDocumentProxy
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  } catch (e) {
    const naam = (e as { name?: string }).name
    bevindingen.push({
      status: 'fout',
      titel: naam === 'PasswordException' ? 'Met wachtwoord beveiligd' : 'Bestand kan niet worden geopend',
      uitleg: naam === 'PasswordException' ? 'Haal het wachtwoord eraf en sla opnieuw op als PDF/A.' : 'Het bestand lijkt beschadigd of is geen echte pdf.',
    })
    return { paginas: 0, bevindingen, tekstPerPagina: [] }
  }

  const paginas = doc.numPages
  const tekstPerPagina: string[] = []
  const nietA4: number[] = []
  const margeTe: { kant: string; pagina: number; pt: number }[] = []
  const alleRegels: { pagina: number; regels: Regel[] }[] = []
  let tekens = 0

  for (let p = 1; p <= paginas; p++) {
    const pagina = await doc.getPage(p)
    const vp = pagina.getViewport({ scale: 1 })
    const staand = Math.abs(vp.width - A4.b) < 3 && Math.abs(vp.height - A4.h) < 3
    const liggend = Math.abs(vp.width - A4.h) < 3 && Math.abs(vp.height - A4.b) < 3
    if (!staand && !liggend) nietA4.push(p)

    // Producties: alleen de eerste pagina's lezen, voor de tekstlaag-controle.
    if (soort === 'productie' && p > 3) {
      pagina.cleanup()
      continue
    }
    const inhoud = await pagina.getTextContent()
    const items = inhoud.items.filter((i): i is (typeof inhoud.items)[number] & { str: string; transform: number[]; width: number } => 'str' in i)
    const tekst = items.map((i) => i.str + ((i as { hasEOL?: boolean }).hasEOL ? '\n' : '')).join('')
    tekstPerPagina.push(tekst)
    tekens += tekst.replace(/\s/g, '').length

    if (soort === 'processtuk') {
      const regels = regelsVan(items)
      alleRegels.push({ pagina: p, regels })
      // Marges: korte regels (paginanummers) tellen niet mee.
      const meetbaar = regels.filter((r) => r.tekst.trim().length > 3)
      if (meetbaar.length) {
        const links = Math.min(...meetbaar.map((r) => r.x0))
        const rechts = vp.width - Math.max(...meetbaar.map((r) => r.x1))
        const boven = vp.height - Math.max(...meetbaar.map((r) => r.y + r.grootte * 0.8))
        const onder = Math.min(...meetbaar.map((r) => r.y - r.grootte * 0.2))
        for (const [kant, pt] of [['links', links], ['rechts', rechts], ['boven', boven], ['onder', onder]] as const) {
          if (pt < MARGE_PT - MARGE_SPELING_PT) margeTe.push({ kant, pagina: p, pt })
        }
      }
    }
    pagina.cleanup()
  }

  // 4. Tekstlaag (OCR)
  const gelezen = tekstPerPagina.length
  if (gelezen && tekens / gelezen < 50) {
    bevindingen.push({
      status: 'let-op',
      titel: 'Weinig of geen doorzoekbare tekst',
      uitleg: 'Waarschijnlijk een scan zonder tekstlaag. De Rechtspraak vraagt bij voorkeur 300 dpi met een OCR-laag voor tekstherkenning.',
      bron: 'Rechtspraak, digitaal procederen dagvaardingszaken handel',
    })
  }

  if (soort === 'processtuk') {
    // 5. A4
    bevindingen.push(
      nietA4.length
        ? { status: 'fout', titel: `Niet op A4-formaat (${paginaLijst(nietA4)})`, bron: 'Art. 2.13' }
        : { status: 'ok', titel: 'Alle pagina\'s op A4', bron: 'Art. 2.13' },
    )

    // 6. Lettergrootte en regelafstand van de lopende tekst
    const gewogen = alleRegels.flatMap(({ regels }) => regels.map((r) => ({ v: r.grootte, gewicht: r.tekst.length })))
    const romp = modus(gewogen)
    if (romp) {
      const rond = romp.toFixed(1).replace('.', ',').replace(',0', '')
      bevindingen.push(
        romp < 10.95
          ? { status: 'fout', titel: `Lopende tekst in ${rond} punt`, uitleg: 'De lopende tekst moet minimaal 11 punt zijn.', bron: 'Art. 2.13' }
          : { status: 'ok', titel: `Lopende tekst in ${rond} punt`, bron: 'Art. 2.13' },
      )
      const afstanden: number[] = []
      for (const { regels } of alleRegels) {
        for (let i = 1; i < regels.length; i++) {
          const a = regels[i - 1]
          const b = regels[i]
          if (Math.abs(a.grootte - romp) > 0.6 || Math.abs(b.grootte - romp) > 0.6) continue
          const gat = a.y - b.y
          if (gat > romp * 0.7 && gat < romp * 2.6) afstanden.push(gat / romp)
        }
      }
      const factor = mediaan(afstanden)
      if (factor) {
        const f = factor.toFixed(2).replace('.', ',')
        const uitleg = `Gemeten afstand tussen de regels: ${f} keer de lettergrootte. Enkele regelafstand in Word is meestal ongeveer 1,15 tot 1,2 keer.`
        bevindingen.push(
          factor < 1.0
            ? { status: 'fout', titel: 'Regelafstand kleiner dan 1', uitleg, bron: 'Art. 2.13' }
            : factor < 1.1
              ? { status: 'let-op', titel: 'Regelafstand mogelijk kleiner dan 1', uitleg, bron: 'Art. 2.13' }
              : { status: 'ok', titel: 'Regelafstand minimaal 1', uitleg, bron: 'Art. 2.13' },
        )
      }
    }

    // 7. Marges
    if (margeTe.length) {
      const perKant = new Map<string, { paginas: number[]; min: number }>()
      for (const m of margeTe) {
        const k = perKant.get(m.kant) ?? { paginas: [], min: Infinity }
        k.paginas.push(m.pagina)
        k.min = Math.min(k.min, m.pt)
        perKant.set(m.kant, k)
      }
      for (const [kant, { paginas: ps, min }] of perKant) {
        bevindingen.push({
          status: 'let-op',
          titel: `Marge ${kant} ${cm(Math.max(min, 0))} cm (${paginaLijst(ps)})`,
          uitleg: 'De marges moeten rondom 2,5 cm zijn. Tekst in een kop- of voettekst kan dit ook veroorzaken; controleer de pagina.',
          bron: 'Art. 2.13',
        })
      }
    } else if (alleRegels.length) {
      bevindingen.push({ status: 'ok', titel: 'Marges rondom minimaal 2,5 cm', bron: 'Art. 2.13' })
    }

    // 8. Omvang: meer dan 10 en meer dan 25 pagina's
    if (paginas > 10) {
      const begin = tekstPerPagina.slice(0, 2).join(' ')
      bevindingen.push(
        /samenvatting/i.test(begin)
          ? { status: 'ok', titel: 'Begint met een samenvatting', uitleg: `Het stuk heeft ${paginas} pagina's; het woord "samenvatting" staat op de eerste twee pagina's.`, bron: 'Art. 2.13' }
          : { status: 'let-op', titel: 'Geen samenvatting gevonden', uitleg: `Het stuk heeft ${paginas} pagina's. Boven de 10 pagina's begint een processtuk met een samenvatting.`, bron: 'Art. 2.13' },
      )
      const koppen = alleRegels.flatMap(({ regels }) =>
        regels.filter((r) => {
          const t = r.tekst.trim()
          if (t.length > 90) return false
          return (romp && r.grootte > romp + 0.9) || KOP.test(t)
        }),
      ).length
      bevindingen.push(
        koppen >= 2
          ? { status: 'ok', titel: `${koppen} tussenkopjes herkend`, bron: 'Art. 2.13' }
          : { status: 'let-op', titel: 'Geen tussenkopjes herkend', uitleg: 'Boven de 10 pagina\'s bevat een processtuk tussenkopjes. Controleer het stuk; vetgedrukte kopjes in gewone lettergrootte herkent deze controle niet altijd.', bron: 'Art. 2.13' },
      )
    }
    if (paginas > 25) {
      const vindplaats = tekstPerPagina.findIndex((t) => /omvang/i.test(t))
      bevindingen.push(
        vindplaats >= 0
          ? { status: 'let-op', titel: 'Toelichting op de omvang: controleer', uitleg: `Het woord "omvang" staat op pagina ${vindplaats + 1}. Controleer of daar kort staat waarom ${paginas} pagina's nodig zijn.`, bron: 'Art. 2.13' }
          : { status: 'let-op', titel: 'Geen toelichting op de omvang gevonden', uitleg: `Het stuk heeft ${paginas} pagina's. Boven de 25 pagina's wordt kort toegelicht waarom die omvang nodig is. Inkorten is een keuze van de advocaat.`, bron: 'Art. 2.13' },
      )
    }
    if (paginas <= 10) {
      bevindingen.push({ status: 'info', titel: `${paginas} pagina's`, uitleg: 'Geen extra eisen aan de omvang tot en met 10 pagina\'s.', bron: 'Art. 2.13' })
    }
  }

  await doc.destroy()
  return { paginas, bevindingen, tekstPerPagina }
}

function paginaLijst(ps: number[]): string {
  if (ps.length === 1) return `pagina ${ps[0]}`
  if (ps.length <= 4) return `pagina's ${ps.join(', ')}`
  return `${ps.length} pagina's, vanaf pagina ${ps[0]}`
}

