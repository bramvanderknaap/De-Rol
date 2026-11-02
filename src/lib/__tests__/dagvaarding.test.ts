import { describe, expect, it } from 'vitest'
import { iso } from '../datum'
import { controleer, eindeTermijn, herken, maakTekst, uitersteBetekening, uitersteIndiening, vindDatums, vindKerndatums, vroegsteRoldatum, type Opties } from '../dagvaarding'
import { HANDEL } from './fixtures/dagvaarding-handel'

const d = (s: string) => new Date(s + 'T00:00:00')
const basis: Opties = { zaak: 'handel', moment: 'betekend', meerGedaagden: false, woonplaats: 'nl', consument: false, verkort: false, gemachtigde: false }

describe('datums lezen', () => {
  it('leest een datum in woorden met jaar in woorden', () => {
    const [g] = vindDatums('Heden, de vierde november tweeduizend zesentwintig, op verzoek van')
    expect(iso(g.datum)).toBe('2026-11-04')
  })
  it('leest "het jaar tweeduizend ... de ... dag"', () => {
    const [g] = vindDatums('In het jaar tweeduizend zesentwintig, de achttiende november, op verzoek')
    expect(iso(g.datum)).toBe('2026-11-18')
  })
  it('leest cijfers en de numerieke vorm', () => {
    expect(vindDatums('op 4 november 2026 om').map((g) => iso(g.datum))).toEqual(['2026-11-04'])
    expect(vindDatums('datum 04-11-2026').map((g) => iso(g.datum))).toEqual(['2026-11-04'])
  })
  it('slaat onmogelijke datums over', () => {
    expect(vindDatums('31 november 2026 en 30-02-2026')).toEqual([])
  })
  it('vindt betekening, roldatum en uur in de proefdagvaarding', () => {
    const k = vindKerndatums(maakTekst(HANDEL))
    expect(iso(k.betekening!.datum)).toBe('2026-11-04')
    expect(iso(k.roldatum!.datum)).toBe('2026-11-18')
    expect(k.uur).toBe('10.00')
  })
})

describe('termijn van dagvaarding (art. 114, 115, 119 Rv)', () => {
  it('een week: betekend woensdag 4 november, vroegste roldatum donderdag 12 november', () => {
    expect(iso(eindeTermijn(d('2026-11-04'), 'nl'))).toBe('2026-11-11')
    expect(iso(vroegsteRoldatum(d('2026-11-04'), 'nl'))).toBe('2026-11-12')
  })
  it('vier weken en drie maanden', () => {
    expect(iso(vroegsteRoldatum(d('2026-11-04'), 'eu'))).toBe('2026-12-03')
    expect(iso(vroegsteRoldatum(d('2026-11-04'), 'elders'))).toBe('2027-02-05')
  })
  it('einde op zaterdag schuift door naar maandag (art. 1 Atw)', () => {
    // 7 november 2026 + 7 = zaterdag 14 november
    expect(iso(eindeTermijn(d('2026-11-07'), 'nl'))).toBe('2026-11-16')
  })
  it('uiterste betekening voor roldatum woensdag 18 november', () => {
    expect(iso(uitersteBetekening(d('2026-11-18'), 'nl'))).toBe('2026-11-10')
  })
  it('indienen uiterlijk op de werkdag voor de roldatum (art. 125 lid 2)', () => {
    expect(iso(uitersteIndiening(d('2026-11-18')))).toBe('2026-11-17')
  })
})

describe('controle op de vormvereisten', () => {
  const t = maakTekst(HANDEL)
  it('herkent een handelszaak met één gedaagde', () => {
    const h = herken(t)
    expect(h.zaak).toBe('handel')
    expect(h.meerGedaagden).toBeUndefined()
  })
  it('vindt alle verplichte onderdelen in een volledige dagvaarding', () => {
    const uit = controleer(t, basis)
    const niet = uit.filter((e) => e.status === 'fout').map((e) => `${e.nr} ${e.titel}`)
    expect(niet).toEqual([])
    expect(uit.find((e) => e.nr === '6')!.status).toBe('let-op')
    expect(uit.find((e) => e.nr === '10')!.vindplaats!.pagina).toBe(1)
    expect(uit.find((e) => e.nr === '14')!.vindplaats!.pagina).toBe(2)
  })
  it('slaat de onderdelen van de deurwaarder over bij een concept', () => {
    const nrs = controleer(t, { ...basis, moment: 'concept' }).map((e) => e.nr)
    expect(nrs).not.toContain('1')
    expect(nrs).not.toContain('3')
    expect(nrs).not.toContain('6')
  })
  it('meldt wat ontbreekt bij meer gedaagden', () => {
    const uit = controleer(t, { ...basis, meerGedaagden: true })
    expect(uit.filter((e) => e.status === 'fout').map((e) => e.bron)).toEqual(['Art. 111 lid 2 onder j Rv', 'Art. 111 lid 2 onder l Rv'])
  })
  it('meldt een ontbrekende verstekaanzegging', () => {
    const zonder = maakTekst([HANDEL[0], HANDEL[1].replace(/verstek/g, 'iets'), HANDEL[2]])
    const e = controleer(zonder, basis).find((x) => x.nr === '13')!
    expect(e.status).toBe('fout')
    expect(e.uitleg).toMatch(/art\. 120 lid 1/)
  })
})
