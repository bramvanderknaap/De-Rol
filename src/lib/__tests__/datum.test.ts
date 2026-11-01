import { describe, expect, it } from 'vitest'
import { feestdagen, isWerkdag, iso, paaszondag, vanIso, werkdagenTerug } from '../datum'

describe('feestdagen (art. 3 Algemene termijnenwet)', () => {
  it('berekent Pasen goed', () => {
    expect(iso(paaszondag(2026))).toBe('2026-04-05')
    expect(iso(paaszondag(2027))).toBe('2027-03-28')
  })
  it('kent alle feestdagen van 2026', () => {
    expect(feestdagen(2026).map((f) => f.datum)).toEqual([
      '2026-01-01', '2026-04-03', '2026-04-06', '2026-04-27', '2026-05-05', '2026-05-14', '2026-05-25', '2026-12-25', '2026-12-26',
    ])
  })
  it('zet Koningsdag op 26 april als 27 april een zondag is', () => {
    expect(feestdagen(2025).find((f) => f.naam === 'Koningsdag')?.datum).toBe('2025-04-26')
  })
  it('telt werkdagen terug over het weekend en feestdagen', () => {
    expect(iso(werkdagenTerug(vanIso('2026-12-16'), 4))).toBe('2026-12-10')
    // Vóór woensdag 8 april 2026: di 7, (ma 6 = 2e Paasdag), (vr 3 = Goede Vrijdag), do 2, wo 1, di 31 mrt
    expect(iso(werkdagenTerug(vanIso('2026-04-08'), 4))).toBe('2026-03-31')
    expect(isWerkdag(vanIso('2026-05-05'))).toBe(false)
  })
})
