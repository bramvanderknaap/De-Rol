import { describe, expect, it } from 'vitest'
import { controleerBestandsnaam, controleerNummering, leesProductienaam } from '../bestandsnaam'
import { genoemdeProducties } from '../verwijzingen'

describe('bestandsnamen (bijlage II)', () => {
  it('leest het voorbeeld van de Rechtspraak', () => {
    expect(leesProductienaam('EIS – productie 1 – koopovereenkomst.pdf')).toMatchObject({ partij: 'EIS', nummer: 1, omschrijving: 'koopovereenkomst' })
    expect(leesProductienaam('GED1-3 - productie 12 - brief deel 2.pdf')).toMatchObject({ partij: 'GED1-3', nummer: 12, deel: 2 })
  })
  it('keurt accenten en symbolen af', () => {
    const b = controleerBestandsnaam('EIS – productie 2 – e-mail café & co.pdf')
    expect(b.filter((x) => x.status === 'fout').map((x) => x.titel)).toEqual(['Letters met accent in de naam', 'Symbolen in de naam'])
  })
  it('vindt gaten en dubbele nummers', () => {
    const n = controleerNummering([1, 2, 2, 4].map((nummer) => ({ partij: 'EIS', nummer, omschrijving: 'x' })))
    expect(n[0]).toMatchObject({ ontbreekt: [3], dubbel: [2], hoogste: 4 })
  })
  it('telt delen van één productie niet als dubbel', () => {
    const n = controleerNummering([{ partij: 'EIS', nummer: 1, omschrijving: 'a deel 1', deel: 1 }, { partij: 'EIS', nummer: 1, omschrijving: 'a deel 2', deel: 2 }])
    expect(n[0].dubbel).toEqual([])
  })
  it('herkent verwijzingen naar producties', () => {
    expect([...genoemdeProducties('Zie productie 3 en producties 5 t/m 7, en productie 9.')].sort((a, b) => a - b)).toEqual([3, 5, 6, 7, 9])
  })
})
