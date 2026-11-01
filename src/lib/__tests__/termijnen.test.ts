import { describe, expect, it } from 'vitest'
import { iso, vanIso } from '../datum'
import { TERMIJNEN } from '../termijnen'

const t = (id: string) => TERMIJNEN.find((x) => x.id === id)!

describe('termijnen handelszaken', () => {
  it('conclusie van antwoord: zes weken na verschijning (art. 2.23, 4.4)', () => {
    expect(iso(t('cva').bereken(vanIso('2026-11-04'))[0].datum)).toBe('2026-12-16')
  })
  it('akte: twee weken', () => {
    expect(iso(t('akte').bereken(vanIso('2026-11-04'))[0].datum)).toBe('2026-11-18')
  })
  it('signaleert een roldatum op een feestdag', () => {
    // Kerst 2030 valt op woensdag 25 december.
    const u = t('akte').bereken(vanIso('2030-12-11'))[0]
    expect(iso(u.datum)).toBe('2030-12-25')
    expect(u.signalen[0]).toMatch(/Eerste Kerstdag/)
  })
  it('dagvaarding: laatste werkdag vóór de roldatum (art. 3.1)', () => {
    expect(iso(t('dagvaarding').bereken(vanIso('2026-11-04'))[0].datum)).toBe('2026-11-03')
    expect(iso(t('dagvaarding').bereken(vanIso('2026-04-08'))[0].datum)).toBe('2026-04-07')
  })
  it('stukken mondelinge behandeling: tien kalenderdagen ervoor (art. 5.7)', () => {
    const u = t('mb-stukken').bereken(vanIso('2026-11-20'))[0]
    expect(iso(u.datum)).toBe('2026-11-10')
    const za = t('mb-stukken').bereken(vanIso('2026-11-24'))[0]
    expect(iso(za.datum)).toBe('2026-11-14')
    expect(za.signalen.join(' ')).toMatch(/zaterdag/)
  })
  it('parkeerrol: januari-juni naar eerste roldatum oktober, juli-december naar april (art. 8.2.4)', () => {
    const voorjaar = t('parkeerrol').bereken(vanIso('2026-03-11'))
    expect(iso(voorjaar[0].datum)).toBe('2026-10-07')
    expect(iso(voorjaar[1].datum)).toBe('2026-10-01')
    const najaar = t('parkeerrol').bereken(vanIso('2026-11-04'))
    expect(iso(najaar[0].datum)).toBe('2027-04-07')
  })
})
