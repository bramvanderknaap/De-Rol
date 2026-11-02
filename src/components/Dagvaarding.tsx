import { useMemo, useRef, useState } from 'react'
import { iso, isWerkdag, lang, vanIso } from '../lib/datum'
import {
  controleer, herken, maakTekst, TERMIJN, uitersteBetekening, uitersteIndiening, vindKerndatums, vroegsteRoldatum,
  type Eis, type Moment, type Opties, type Tekst, type Uitslag, type Woonplaats, type Zaak,
} from '../lib/dagvaarding'

const LABEL: Record<Uitslag, string> = { fout: 'Voldoet niet', 'let-op': 'Controleren', info: 'Ter info', ok: 'Voldoet' }

const BEGIN: Opties = { zaak: 'handel', moment: 'betekend', meerGedaagden: false, woonplaats: 'nl', consument: false, verkort: false, gemachtigde: false }

const WOONPLAATS: { waarde: Woonplaats; tekst: string }[] = [
  { waarde: 'nl', tekst: 'In Nederland' },
  { waarde: 'eu', tekst: 'In een ander EU-land, of een Europees land bij het Haags betekeningsverdrag' },
  { waarde: 'elders', tekst: 'In een ander land' },
  { waarde: 'nl-betekend', tekst: 'Niet in Nederland, maar hier in persoon of aan een gekozen woonplaats betekend' },
]

type Bestand = { naam: string; tekst?: Tekst; fout?: string; bezig: boolean }
type Sleutel = keyof Opties

function Keuze<T extends string | boolean>({ naam, legend, waarde, opties, onKies, herkend }: {
  naam: string; legend: string; waarde: T; opties: { waarde: T; tekst: string }[]; onKies: (w: T) => void; herkend?: boolean
}) {
  return (
    <fieldset className="keuze">
      <legend>{legend}{herkend && <span className="herkend">uit de tekst</span>}</legend>
      <div className="segment">
        {opties.map((o) => (
          <label key={String(o.waarde)} className={o.waarde === waarde ? 'aan' : undefined}>
            <input type="radio" name={naam} checked={o.waarde === waarde} onChange={() => onKies(o.waarde)} />
            {o.tekst}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const JA_NEE = [{ waarde: false, tekst: 'Nee' }, { waarde: true, tekst: 'Ja' }]

export default function Dagvaarding() {
  const [o, setO] = useState<Opties>(BEGIN)
  const [herkend, setHerkend] = useState<Set<Sleutel>>(new Set())
  const [bestand, setBestand] = useState<Bestand | null>(null)
  const [betekening, setBetekening] = useState('')
  const [roldatum, setRoldatum] = useState('')
  const [uur, setUur] = useState<string | undefined>()
  const [slepen, setSlepen] = useState(false)
  const invoer = useRef<HTMLInputElement>(null)

  function zet<K extends Sleutel>(k: K, w: Opties[K]) {
    setO((oud) => ({ ...oud, [k]: w }))
    setHerkend((h) => { const n = new Set(h); n.delete(k); return n })
  }

  async function lees(lijst: FileList | null) {
    const f = lijst?.[0]
    if (!f) return
    setBestand({ naam: f.name, bezig: true })
    try {
      const { leesTekst } = await import('../lib/analyse')
      const { paginas, fout } = await leesTekst(f)
      if (fout) { setBestand({ naam: f.name, fout, bezig: false }); return }
      const tekst = maakTekst(paginas)
      const h = herken(tekst)
      setO((oud) => ({ ...oud, ...h }))
      setHerkend(new Set(Object.keys(h) as Sleutel[]))
      const k = vindKerndatums(tekst)
      setBetekening(k.betekening ? iso(k.betekening.datum) : '')
      setRoldatum(k.roldatum ? iso(k.roldatum.datum) : '')
      setUur(k.uur)
      setBestand({ naam: f.name, tekst, bezig: false })
    } catch {
      setBestand({ naam: f.name, fout: 'Het bestand kon niet worden gelezen.', bezig: false })
    }
  }

  function wis() {
    setBestand(null); setBetekening(''); setRoldatum(''); setUur(undefined); setHerkend(new Set())
  }

  const eisen = useMemo(() => (bestand?.tekst ? controleer(bestand.tekst, o) : []), [bestand, o])
  const termijn = useMemo(() => termijnUitslag(o, betekening, roldatum, uur), [o, betekening, roldatum, uur])

  const alle = [...eisen.map((e) => e.status), ...termijn.map((t) => t.status)]
  const fout = alle.filter((s) => s === 'fout').length
  const letop = alle.filter((s) => s === 'let-op').length

  const groepen: { titel: string; eisen: Eis[] }[] = [
    { titel: 'Het exploot (art. 45 Rv)', eisen: eisen.filter((e) => e.bron.startsWith('Art. 45')) },
    { titel: 'Wat de dagvaarding vermeldt (art. 111 lid 2 Rv)', eisen: eisen.filter((e) => e.bron.startsWith('Art. 111 lid 2')) },
    { titel: 'Verder', eisen: eisen.filter((e) => !e.bron.startsWith('Art. 45') && !e.bron.startsWith('Art. 111 lid 2')) },
  ].filter((g) => g.eisen.length)

  return (
    <div className="dagvaarding">
      <section className="intro">
        <h1>Dagvaarding controleren</h1>
        <p className="bovenregel">Art. 45 en 111 tot en met 125 Rv, procesreglement art. 3.1</p>
        <p className="lead">Sleep een dagvaarding hierheen. Je ziet per vormvereiste of het erin staat en op welke pagina, en of de termijn van dagvaarding klopt.</p>
      </section>

      <section className="vragen" aria-label="Over de zaak">
        <Keuze naam="zaak" legend="Soort zaak" waarde={o.zaak} herkend={herkend.has('zaak')} onKies={(w: Zaak) => zet('zaak', w)}
          opties={[{ waarde: 'handel', tekst: 'Handel' }, { waarde: 'kanton', tekst: 'Kanton' }]} />
        <Keuze naam="moment" legend="Welke versie controleer je?" waarde={o.moment} onKies={(w: Moment) => zet('moment', w)}
          opties={[{ waarde: 'concept', tekst: 'Concept' }, { waarde: 'betekend', tekst: 'Betekend' }]} />
        <Keuze naam="meer" legend="Meer dan één gedaagde?" waarde={o.meerGedaagden} herkend={herkend.has('meerGedaagden')} onKies={(w) => zet('meerGedaagden', w)} opties={JA_NEE} />
        <Keuze naam="consument" legend="Consumentenzaak?" waarde={o.consument} herkend={herkend.has('consument')} onKies={(w) => zet('consument', w)} opties={JA_NEE} />
        <Keuze naam="verkort" legend="Termijn verkort door de rechter (art. 117 Rv)?" waarde={o.verkort} herkend={herkend.has('verkort')} onKies={(w) => zet('verkort', w)} opties={JA_NEE} />
        {o.zaak === 'kanton' && (
          <Keuze naam="gemachtigde" legend="Procedeert de eiser bij gemachtigde?" waarde={o.gemachtigde} herkend={herkend.has('gemachtigde')} onKies={(w) => zet('gemachtigde', w)} opties={JA_NEE} />
        )}
        <label className="keuze breed-veld">
          <span className="legend">Woonplaats van de gedaagde{herkend.has('woonplaats') && <span className="herkend">uit de tekst</span>}</span>
          <select value={o.woonplaats} onChange={(e) => zet('woonplaats', e.target.value as Woonplaats)}>
            {WOONPLAATS.map((w) => <option key={w.waarde} value={w.waarde}>{w.tekst}</option>)}
          </select>
        </label>
      </section>

      <div
        className={`neerzet${slepen ? ' actief' : ''}${bestand ? ' compact' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setSlepen(true) }}
        onDragLeave={() => setSlepen(false)}
        onDrop={(e) => { e.preventDefault(); setSlepen(false); lees(e.dataTransfer.files) }}
      >
        <input ref={invoer} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { lees(e.target.files); e.target.value = '' }} />
        <div className="neerzet-tekst">
          <p className="neerzet-titel">{bestand ? bestand.naam : 'Sleep de dagvaarding hierheen'}</p>
          <p className="neerzet-sub">Eén pdf met tekstlaag. Het bestand wordt alleen in deze browser gelezen. Er wordt niets geüpload of bewaard.</p>
        </div>
        <button className="knop" onClick={() => invoer.current?.click()}>{bestand ? 'Ander bestand' : 'Kies bestand'}</button>
      </div>

      {bestand?.fout && <p className="melding fout">{bestand.fout}</p>}

      {bestand && !bestand.fout && (
        <>
          <div className="balk">
            <p className="stand" aria-live="polite">
              {bestand.bezig ? 'Bezig met lezen…' : fout + letop === 0 ? 'Alles wat de checker kan zien, staat erin.' : [fout ? `${fout} voldoet niet` : '', letop ? `${letop} om te controleren` : ''].filter(Boolean).join(', ')}
            </p>
            <div className="balk-rechts">
              <button className="knop stil" onClick={wis}>Wissen</button>
            </div>
          </div>

          {!bestand.bezig && (
            <>
              <section className="blok">
                <h2>Termijn en indienen</h2>
                <div className="termijn-vak">
                  <div className="datums">
                    {o.moment === 'betekend' && (
                      <label className="veld">
                        <span>Datum van betekening</span>
                        <input type="date" value={betekening} onChange={(e) => setBetekening(e.target.value)} />
                      </label>
                    )}
                    <label className="veld">
                      <span>Roldatum in de dagvaarding</span>
                      <input type="date" value={roldatum} onChange={(e) => setRoldatum(e.target.value)} />
                    </label>
                  </div>
                  <ul className="eisen">{termijn.map((t, i) => <EisRegel key={i} e={t} />)}</ul>
                </div>
              </section>

              {groepen.map((g) => (
                <section key={g.titel} className="blok">
                  <h2>{g.titel}</h2>
                  <ul className="eisen">{g.eisen.map((e) => <EisRegel key={e.nr + e.titel} e={e} />)}</ul>
                </section>
              ))}

              {o.moment === 'concept' && (
                <p className="klein voetnoot">Bij een concept slaat de checker over wat de deurwaarder pas invult: de datum van betekening, de gegevens van de deurwaarder, aan wie het afschrift is gelaten en de handtekening (art. 45 lid 3 onder a, c en e en lid 5 Rv).</p>
              )}
            </>
          )}
        </>
      )}

      <section className="uitleg">
        <h2 className="bovenregel">Wat de checker wel en niet doet</h2>
        <p className="klein">De checker zoekt of een verplicht onderdeel in de tekst staat, en laat de passage zien waar hij het vond. Of het onderdeel inhoudelijk klopt, beoordeelt hij niet. Een handtekening kan hij niet zien, en een scan zonder tekstlaag kan hij niet lezen. Wat in art. 111 lid 2 Rv staat, geldt op straffe van nietigheid (art. 120 lid 1 Rv); herstel kan bij exploot, uitgebracht vóór de roldatum (art. 120 lid 2 Rv). Voor de vermeldingen van art. 45 lid 3 Rv geldt dat nietigheid alleen volgt als de gedaagde onredelijk is benadeeld (art. 66 lid 1 Rv).</p>
      </section>
    </div>
  )
}

function EisRegel({ e }: { e: Eis }) {
  return (
    <li className={`eis ${e.status}`}>
      <span className={`label ${e.status}`}>{LABEL[e.status]}</span>
      <div>
        <p className="b-titel">{e.titel}</p>
        <p className="b-bron">{e.bron}</p>
        {e.vindplaats && (
          <blockquote className="vindplaats"><span className="vind-pagina">p. {e.vindplaats.pagina}</span>{e.vindplaats.tekst}</blockquote>
        )}
        {e.uitleg && <p className="b-uitleg">{e.uitleg}</p>}
      </div>
    </li>
  )
}

function geldig(s: string): Date | null {
  if (!s) return null
  const d = vanIso(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function termijnUitslag(o: Opties, betekening: string, roldatum: string, uur?: string): Eis[] {
  const uit: Eis[] = []
  const rol = geldig(roldatum)
  const bet = geldig(betekening)
  const t = TERMIJN[o.woonplaats]

  if (!rol) {
    uit.push({ nr: 't1', titel: 'Geen roldatum gevonden', bron: 'Art. 111 lid 2 onder f Rv', status: 'let-op', uitleg: 'Vul de roldatum hierboven in om de termijn te laten berekenen.' })
    return uit
  }

  if (!isWerkdag(rol)) {
    uit.push({ nr: 't0', titel: `De roldatum valt op ${lang(rol)}`, bron: 'Art. 3 Algemene termijnenwet', status: 'let-op', uitleg: 'Dat is een zaterdag, zondag of algemeen erkende feestdag. Controleer de rolkalender van de rechtbank.' })
  } else if (o.zaak === 'handel' && rol.getDay() !== 3) {
    uit.push({ nr: 't0', titel: `De roldatum is een ${lang(rol).split(' ')[0]}`, bron: 'Art. 1.5 procesreglement', status: 'let-op', uitleg: 'De roldag in handelszaken is woensdag om 10.00 uur. Controleer de rolkalender van de rechtbank.' })
  }

  if (o.zaak === 'handel' && uur && uur !== '10.00') {
    uit.push({ nr: 't0', titel: `Het uur in de dagvaarding is ${uur} uur`, bron: 'Art. 1.5 procesreglement', status: 'let-op', uitleg: 'De roldag in handelszaken is woensdag om 10.00 uur.' })
  }

  if (o.verkort) {
    uit.push({ nr: 't2', titel: 'Verkorte termijn', bron: 'Art. 117 Rv', status: 'let-op', uitleg: 'De rechter heeft de termijn verkort. Controleer of de roldatum past bij de beschikking.' })
  } else if (o.moment === 'betekend') {
    if (!bet) {
      uit.push({ nr: 't2', titel: 'Geen datum van betekening gevonden', bron: 'Art. 45 lid 3 onder a Rv', status: 'let-op', uitleg: 'Vul de datum van betekening in om de termijn te laten berekenen.' })
    } else {
      const vroegst = vroegsteRoldatum(bet, o.woonplaats)
      const goed = rol >= vroegst
      uit.push({
        nr: 't2',
        titel: goed ? `Termijn van dagvaarding in acht genomen` : `Termijn van dagvaarding te kort`,
        bron: `${t.bron}, met art. 119 Rv`,
        status: goed ? 'ok' : 'fout',
        uitleg: `De termijn is ${t.tekst}. Hij begint op de dag na de betekening en de roldatum telt niet mee (art. 119 Rv). Bij betekening op ${lang(bet)} is de vroegste roldatum ${lang(vroegst)}.` +
          (goed ? '' : ' Herstel kan bij exploot met een nieuwe roldatum (art. 120 lid 2 en 3 Rv).') +
          (o.woonplaats === 'eu' ? ' Bij betekening via de EU-betekeningsverordening begint de termijn op de dag na de verzending (art. 119 lid 1, tweede zin, Rv).' : ''),
      })
    }
  } else {
    const uiterst = uitersteBetekening(rol, o.woonplaats)
    const vandaag = new Date(); vandaag.setHours(0, 0, 0, 0)
    uit.push({
      nr: 't2',
      titel: `Uiterlijk betekenen op ${lang(uiterst)}`,
      bron: `${t.bron}, met art. 119 Rv`,
      status: uiterst < vandaag ? 'fout' : 'ok',
      uitleg: `De termijn is ${t.tekst}. Hij begint op de dag na de betekening en de roldatum telt niet mee (art. 119 Rv).` + (uiterst < vandaag ? ' Die datum is al voorbij: kies een latere roldatum.' : ''),
    })
  }

  const indienen = uitersteIndiening(rol)
  uit.push({
    nr: 't3',
    titel: `Indienen uiterlijk op ${lang(indienen)}, tot 24.00 uur`,
    bron: 'Art. 125 lid 2 Rv, art. 3.1 procesreglement',
    status: 'info',
    uitleg: 'Op de laatste dag dat de griffie open is vóór de roldatum. Te laat ingediend, dan vervalt de aanhangigheid, tenzij binnen twee weken na de roldatum een geldig herstelexploot is uitgebracht (art. 125 lid 5 Rv).',
  })
  return uit
}
