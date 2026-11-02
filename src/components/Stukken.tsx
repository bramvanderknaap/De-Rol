import { useCallback, useMemo, useRef, useState } from 'react'
import { genoemdeProducties } from '../lib/verwijzingen'
import { controleerBestandsnaam, controleerNummering, leesProductienaam, lijktProductie } from '../lib/bestandsnaam'
import type { Bevinding, Soort, Status, Stuk } from '../lib/types'

const VOLGORDE: Record<Status, number> = { fout: 0, 'let-op': 1, info: 2, ok: 3 }
const LABEL: Record<Status, string> = { fout: 'Voldoet niet', 'let-op': 'Controleren', info: 'Ter info', ok: 'Voldoet' }

function ergste(b: Bevinding[]): Status {
  return b.reduce<Status>((s, x) => (VOLGORDE[x.status] < VOLGORDE[s] ? x.status : s), 'ok')
}

function mb(bytes: number) {
  if (bytes < 1000 * 1000) return `${Math.max(1, Math.round(bytes / 1000))} kB`
  return `${(bytes / 1000 / 1000).toFixed(1).replace('.', ',')} MB`
}

let teller = 0

export default function Stukken() {
  const [stukken, setStukken] = useState<Stuk[]>([])
  const [partij, setPartij] = useState<'EIS' | 'GED'>('EIS')
  const [slepen, setSlepen] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [gekopieerd, setGekopieerd] = useState(false)
  const invoer = useRef<HTMLInputElement>(null)

  const verwerk = useCallback(async (stuk: Stuk) => {
    const naamBevindingen = controleerBestandsnaam(stuk.naam)
    try {
      const { analyseer } = await import('../lib/analyse')
      const a = await analyseer(stuk.bestand, stuk.soort)
      setStukken((lijst) =>
        lijst.map((s) => (s.id === stuk.id ? { ...s, bezig: false, paginas: a.paginas, tekstPerPagina: a.tekstPerPagina, bevindingen: [...naamBevindingen, ...a.bevindingen] } : s)),
      )
    } catch {
      setStukken((lijst) =>
        lijst.map((s) => (s.id === stuk.id ? { ...s, bezig: false, bevindingen: [...naamBevindingen, { status: 'fout', titel: 'Controle mislukt', uitleg: 'Het bestand kon niet worden gelezen.' }] } : s)),
      )
    }
  }, [])

  function voegToe(lijst: FileList | null) {
    if (!lijst?.length) return
    const nieuw: Stuk[] = [...lijst].map((f) => ({
      id: `s${++teller}`,
      bestand: f,
      naam: f.name,
      grootte: f.size,
      soort: lijktProductie(f.name) ? 'productie' : 'processtuk',
      bezig: true,
      bevindingen: [],
    }))
    setStukken((oud) => [...oud, ...nieuw])
    nieuw.forEach(verwerk)
  }

  function wijzigSoort(stuk: Stuk, soort: Soort) {
    const bijgewerkt = { ...stuk, soort, bezig: true, bevindingen: [] }
    setStukken((lijst) => lijst.map((s) => (s.id === stuk.id ? bijgewerkt : s)))
    verwerk(bijgewerkt)
  }

  function verwijder(id: string) {
    setStukken((lijst) => lijst.filter((s) => s.id !== id))
  }

  const processtukken = stukken.filter((s) => s.soort === 'processtuk')
  const producties = useMemo(
    () =>
      stukken
        .filter((s) => s.soort === 'productie')
        .map((s) => ({ stuk: s, naam: leesProductienaam(s.naam) }))
        .sort((a, b) => (a.naam?.partij ?? 'ZZZ').localeCompare(b.naam?.partij ?? 'ZZZ') || (a.naam?.nummer ?? 1e9) - (b.naam?.nummer ?? 1e9) || (a.naam?.deel ?? 0) - (b.naam?.deel ?? 0)),
    [stukken],
  )

  // Dossiercontroles: nummering (art. 2.14) en verwijzingen in de processtukken.
  const dossier = useMemo(() => {
    const uit: Bevinding[] = []
    const namen = producties.flatMap((p) => (p.naam ? [p.naam] : []))
    for (const n of controleerNummering(namen)) {
      if (n.dubbel.length) uit.push({ status: 'fout', titel: `${n.partij}: productienummer dubbel (${n.dubbel.join(', ')})`, uitleg: 'Iedere partij hanteert een eigen doorlopende nummering.', bron: 'Art. 2.14' })
      if (n.ontbreekt.length) uit.push({ status: 'let-op', titel: `${n.partij}: nummer ${n.ontbreekt.join(', ')} ontbreekt`, uitleg: `De nummering loopt tot ${n.hoogste}. Als deze producties eerder zijn ingediend, is dit in orde.`, bron: 'Art. 2.14' })
      if (!n.dubbel.length && !n.ontbreekt.length) uit.push({ status: 'ok', titel: `${n.partij}: producties 1 tot en met ${n.hoogste} doorlopend genummerd`, bron: 'Art. 2.14' })
    }
    const eigen = new Set(namen.filter((n) => n.partij.startsWith(partij)).map((n) => n.nummer))
    const klaar = processtukken.filter((p) => !p.bezig && p.tekstPerPagina)
    if (klaar.length && producties.length) {
      const genoemd = new Set<number>()
      for (const p of klaar) for (const n of genoemdeProducties(p.tekstPerPagina!.join('\n'))) genoemd.add(n)
      const nietBij = [...genoemd].filter((n) => !eigen.has(n)).sort((a, b) => a - b)
      const nietGenoemd = [...eigen].filter((n) => !genoemd.has(n)).sort((a, b) => a - b)
      if (nietBij.length) uit.push({ status: 'let-op', titel: `Genoemd maar niet bijgevoegd: productie ${nietBij.join(', ')}`, uitleg: `Het processtuk noemt deze nummers, maar ze zitten niet bij de producties van ${partij === 'EIS' ? 'eiser' : 'gedaagde'}. Het kan gaan om eerder ingediende producties of producties van de wederpartij.`, bron: 'Art. 2.14' })
      if (nietGenoemd.length) uit.push({ status: 'let-op', titel: `Bijgevoegd maar niet genoemd: productie ${nietGenoemd.join(', ')}`, uitleg: 'In het processtuk worden het nummer en de relevante passages van elke productie aangeduid.', bron: 'Art. 2.14' })
      if (!nietBij.length && !nietGenoemd.length && eigen.size) uit.push({ status: 'ok', titel: 'Elke productie wordt in het processtuk genoemd', bron: 'Art. 2.14' })
    }
    const zonderPatroon = producties.filter((p) => !p.naam).length
    if (zonderPatroon) uit.push({ status: 'let-op', titel: `${zonderPatroon} productie${zonderPatroon > 1 ? 's' : ''} zonder herkenbaar nummer`, uitleg: 'Die tellen niet mee in de nummering en het overzicht. Geef ze een naam als "EIS – productie 1 – koopovereenkomst".', bron: 'Bijlage II, 10.2.2' })
    return uit.sort((a, b) => VOLGORDE[a.status] - VOLGORDE[b.status])
  }, [producties, processtukken, partij])

  const overzicht = producties.filter((p) => p.naam && p.naam.partij.startsWith(partij))
  const telling = useMemo(() => {
    const alle = [...stukken.map((s) => ergste(s.bevindingen)), ...dossier.map((d) => d.status)]
    return { fout: alle.filter((s) => s === 'fout').length, letop: alle.filter((s) => s === 'let-op').length }
  }, [stukken, dossier])
  const bezig = stukken.some((s) => s.bezig)

  async function kopieer() {
    const regels = overzicht.map(({ stuk, naam }) => `Productie ${naam!.nummer}\t${naam!.omschrijving}${stuk.paginas ? `\t${stuk.paginas} p.` : ''}`)
    await navigator.clipboard.writeText(`Productieoverzicht ${partij === 'EIS' ? 'eiser' : 'gedaagde'}\n\n${regels.join('\n')}`)
    setGekopieerd(true)
    setTimeout(() => setGekopieerd(false), 2000)
  }

  return (
    <div className="stukken">
      <section className="intro">
        <h1>Stukken controleren</h1>
        <p className="bovenregel">Procesreglement handelszaken, art. 2.13 en 2.14</p>
        <p className="lead">Sleep een processtuk en de producties hierheen. Je ziet per bestand of het voldoet aan het procesreglement en de eisen van Mijn Rechtspraak.</p>
        <ul className="kenmerken" aria-label="Kenmerken">
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
            Blijft op je computer
          </li>
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12.2 2.7 2.7L16.2 9.4" /></svg>
            Bron bij elke controle
          </li>
          <li>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5.5c0 4.3 2.9 8 7 9.5 4.1-1.5 7-5.2 7-9.5V6l-7-3Z" /></svg>
            Geen account nodig
          </li>
        </ul>
      </section>

      <div
        className={`neerzet${slepen ? ' actief' : ''}${stukken.length ? ' compact' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setSlepen(true) }}
        onDragLeave={() => setSlepen(false)}
        onDrop={(e) => { e.preventDefault(); setSlepen(false); voegToe(e.dataTransfer.files) }}
      >
        <input ref={invoer} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => { voegToe(e.target.files); e.target.value = '' }} />
        <div className="neerzet-tekst">
          <p className="neerzet-titel">{stukken.length ? 'Meer bestanden toevoegen' : 'Sleep pdf-bestanden hierheen'}</p>
          <p className="neerzet-sub">De bestanden worden alleen in deze browser gelezen. Er wordt niets geüpload of bewaard.</p>
        </div>
        <button className="knop" onClick={() => invoer.current?.click()}>Kies bestanden</button>
      </div>

      {stukken.length > 0 && (
        <>
          <div className="balk">
            <p className="stand" aria-live="polite">
              {bezig ? 'Bezig met controleren…' : telling.fout + telling.letop === 0 ? 'Alles voldoet aan de controles.' : [telling.fout ? `${telling.fout} voldoet niet` : '', telling.letop ? `${telling.letop} om te controleren` : ''].filter(Boolean).join(', ')}
            </p>
            <div className="balk-rechts">
              <label className="veld-inline">
                Wij procederen voor
                <select value={partij} onChange={(e) => setPartij(e.target.value as 'EIS' | 'GED')}>
                  <option value="EIS">eiser</option>
                  <option value="GED">gedaagde</option>
                </select>
              </label>
              <button className="knop stil" onClick={() => { setStukken([]); setOpen(null) }}>Alles wissen</button>
            </div>
          </div>

          {dossier.length > 0 && (
            <section className="blok">
              <h2>Dossier</h2>
              <ul className="bevindingen los">{dossier.map((b, i) => <BevindingRegel key={i} b={b} />)}</ul>
            </section>
          )}

          {processtukken.length > 0 && (
            <section className="blok">
              <h2>Processtukken</h2>
              <ul className="stuklijst">
                {processtukken.map((s) => <StukRegel key={s.id} stuk={s} open={open === s.id} onOpen={() => setOpen(open === s.id ? null : s.id)} onSoort={(x) => wijzigSoort(s, x)} onWeg={() => verwijder(s.id)} />)}
              </ul>
            </section>
          )}

          {producties.length > 0 && (
            <section className="blok">
              <h2>Producties</h2>
              <ul className="stuklijst">
                {producties.map(({ stuk, naam }) => (
                  <StukRegel key={stuk.id} stuk={stuk} tab={naam ? `${naam.partij} ${naam.nummer}` : '?'} open={open === stuk.id} onOpen={() => setOpen(open === stuk.id ? null : stuk.id)} onSoort={(x) => wijzigSoort(stuk, x)} onWeg={() => verwijder(stuk.id)} />
                ))}
              </ul>
            </section>
          )}

          {overzicht.length > 0 && (
            <section className="blok overzicht">
              <div className="blok-kop">
                <h2>Productieoverzicht</h2>
                <button className="knop stil" onClick={kopieer}>{gekopieerd ? 'Gekopieerd' : 'Kopieer overzicht'}</button>
              </div>
              <p className="klein">Bij elk processtuk hoort een overzicht van de producties met een korte aanduiding van de inhoud (art. 2.14). Staat een productie in een andere taal dan het Nederlands, vermeld dan de taal en of er een vertaling bij zit (art. 2.16).</p>
              <table>
                <thead><tr><th scope="col">Nr.</th><th scope="col">Omschrijving</th><th scope="col" className="getal">Pagina's</th></tr></thead>
                <tbody>
                  {overzicht.map(({ stuk, naam }) => (
                    <tr key={stuk.id}><td className="getal">{naam!.nummer}</td><td>{naam!.omschrijving}</td><td className="getal">{stuk.paginas ?? '–'}</td></tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {stukken.length === 0 && (
        <section className="uitleg">
          <h2>Wat wordt gecontroleerd</h2>
          <dl>
            <div><dt>Elk bestand</dt><dd>PDF/A, maximaal 25 MB, niet beveiligd, een doorzoekbare tekstlaag en een bestandsnaam zonder accenten of symbolen.</dd></div>
            <div><dt>Processtukken</dt><dd>A4, marges van 2,5 cm, 11 punt, regelafstand minimaal 1. Boven 10 pagina's een samenvatting en tussenkopjes, boven 25 pagina's een toelichting op de omvang (art. 2.13).</dd></div>
            <div><dt>Producties</dt><dd>Naam volgens bijlage II, een eigen doorlopende nummering per partij, en of elk nummer in het processtuk wordt genoemd (art. 2.14).</dd></div>
          </dl>
          <p className="klein">Een bestand met "productie" in de naam wordt als productie behandeld, de rest als processtuk. Je kunt dat per bestand wijzigen.</p>
        </section>
      )}
    </div>
  )
}

function BevindingRegel({ b }: { b: Bevinding }) {
  return (
    <li className={`bevinding ${b.status}`}>
      <span className="stip" aria-hidden="true" />
      <div>
        <p className="b-titel"><span className="sr">{LABEL[b.status]}: </span>{b.titel}</p>
        {b.uitleg && <p className="b-uitleg">{b.uitleg}</p>}
        {b.bron && <p className="b-bron">{b.bron}</p>}
      </div>
    </li>
  )
}

function StukRegel({ stuk, tab, open, onOpen, onSoort, onWeg }: { stuk: Stuk; tab?: string; open: boolean; onOpen: () => void; onSoort: (s: Soort) => void; onWeg: () => void }) {
  const status = stuk.bezig ? null : ergste(stuk.bevindingen)
  const gesorteerd = [...stuk.bevindingen].sort((a, b) => VOLGORDE[a.status] - VOLGORDE[b.status])
  return (
    <li className={`stuk${open ? ' open' : ''}${tab ? ' met-tab' : ''}`}>
      <button className="stuk-kop" aria-expanded={open} onClick={onOpen}>
        <span className="stuk-naam">{stuk.naam}</span>
        <span className="stuk-meta">{[stuk.paginas ? `${stuk.paginas} p.` : null, mb(stuk.grootte)].filter(Boolean).join(', ')}</span>
        <span className={`label ${status ?? 'bezig'}`}>{status === null ? 'Bezig' : status === 'ok' || status === 'info' ? 'Voldoet' : status === 'fout' ? 'Voldoet niet' : 'Controleren'}</span>
        {tab && <span className="tabblad" aria-hidden="true">{tab}</span>}
      </button>
      {open && (
        <div className="stuk-detail">
          {stuk.bezig ? <p className="klein">Bezig met controleren…</p> : <ul className="bevindingen">{gesorteerd.map((b, i) => <BevindingRegel key={i} b={b} />)}</ul>}
          <div className="stuk-acties">
            <label className="veld-inline">
              Soort
              <select value={stuk.soort} onChange={(e) => onSoort(e.target.value as Soort)}>
                <option value="processtuk">processtuk</option>
                <option value="productie">productie</option>
              </select>
            </label>
            <button className="knop stil" onClick={onWeg}>Verwijderen</button>
          </div>
        </div>
      )}
    </li>
  )
}
