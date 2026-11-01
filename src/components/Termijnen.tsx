import { useMemo, useState } from 'react'
import { iso, lang, vanIso } from '../lib/datum'
import { TERMIJNEN, type Groep } from '../lib/termijnen'

const GROEPEN: Groep[] = ['Rol', 'Mondelinge behandeling', 'Griffierecht', 'Parkeerrol']

export default function Termijnen() {
  const [id, setId] = useState(TERMIJNEN[1].id)
  const [datum, setDatum] = useState(() => iso(new Date()))
  const t = TERMIJNEN.find((x) => x.id === id)!

  const invoer = datum ? vanIso(datum) : null
  const uitkomsten = useMemo(() => (invoer && !Number.isNaN(invoer.getTime()) ? t.bereken(invoer) : []), [t, datum]) // eslint-disable-line react-hooks/exhaustive-deps
  const geenWoensdag = t.invoerMoetWoensdag && invoer && invoer.getDay() !== 3

  return (
    <div className="termijnen">
      <section className="intro">
        <h1>Termijnen</h1>
        <p className="lead">Kies een proceshandeling en vul de datum in. Je ziet de uiterste datum met het artikel waarop die rust.</p>
      </section>

      <div className="termijn-raster">
        <nav className="handelingen" aria-label="Proceshandelingen">
          {GROEPEN.map((g) => (
            <div key={g} className="groep">
              <h2>{g}</h2>
              <ul>
                {TERMIJNEN.filter((x) => x.groep === g).map((x) => (
                  <li key={x.id}>
                    <button aria-current={x.id === id ? 'true' : undefined} onClick={() => setId(x.id)}>{x.naam}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <section className="berekening" aria-live="polite">
          <h2 className="handeling">{t.naam}</h2>
          <label className="veld">
            <span>{t.invoer}</span>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
          </label>
          {geenWoensdag && invoer && (
            <p className="melding let-op">Dit is een {lang(invoer).split(' ')[0]}. De roldag in handelszaken is woensdag om 10.00 uur (art. 1.5).</p>
          )}

          {uitkomsten.map((u, i) => (
            <div key={i} className="uitkomst">
              <p className="u-wat">{u.wat}</p>
              <p className="u-datum">{lang(u.datum)}</p>
              {u.signalen.map((s, j) => <p key={j} className="melding let-op">{s}</p>)}
            </div>
          ))}

          <figure className="citaat">
            <blockquote>“{t.citaat}”</blockquote>
            <figcaption>{t.artikel}, Landelijk procesreglement civiele dagvaardingszaken rechtbanken</figcaption>
          </figure>
          {t.toelichting && <p className="klein">{t.toelichting}</p>}
        </section>
      </div>

      <p className="klein voetnoot">
        Feestdagen volgen art. 3 van de Algemene termijnenwet: Nieuwjaarsdag, Goede Vrijdag, tweede Paas- en Pinksterdag, Koningsdag, 5 mei, Hemelvaartsdag en beide Kerstdagen. Controleer afwijkende roldagen in de rolkalender van de rechtbank (art. 1.5).
      </p>
    </div>
  )
}
