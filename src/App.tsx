import { useEffect, useState } from 'react'
import Stukken from './components/Stukken'
import Termijnen from './components/Termijnen'

type Tab = 'stukken' | 'termijnen'
type Thema = 'licht' | 'donker'

function huidigThema(): Thema {
  const gekozen = document.documentElement.dataset.thema
  if (gekozen === 'licht' || gekozen === 'donker') return gekozen
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'donker' : 'licht'
}

function ThemaKnop() {
  const [thema, setThema] = useState<Thema>(huidigThema)
  function wissel() {
    const nieuw: Thema = thema === 'licht' ? 'donker' : 'licht'
    document.documentElement.dataset.thema = nieuw
    try { localStorage.setItem('thema', nieuw) } catch { /* privévenster: alleen voor deze sessie */ }
    setThema(nieuw)
  }
  const label = thema === 'licht' ? 'Donker thema' : 'Licht thema'
  return (
    <button className="thema-knop" onClick={wissel} aria-label={label} title={label}>
      {thema === 'licht' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" />{Array.from({ length: 8 }, (_, i) => <line key={i} x1="12" y1="2.5" x2="12" y2="5" transform={`rotate(${i * 45} 12 12)`} />)}</svg>
      )}
    </button>
  )
}

// Beeldmerk van Legal Pace: een cirkel met stralen (zelfde als op ClaimKompas).
function LegalPaceLogo() {
  const stralen = Array.from({ length: 24 }, (_, i) => (i * 360) / 24)
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {stralen.map((hoek) => (
        <line key={hoek} x1="20" y1="8" x2="20" y2="2.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" transform={`rotate(${hoek} 20 20)`} />
      ))}
    </svg>
  )
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// Knop om De Rol als app te installeren. Alleen zichtbaar als de browser dat aanbiedt (Chrome, Edge).
function Installeer() {
  const [aanbod, setAanbod] = useState<InstallEvent | null>(null)
  useEffect(() => {
    const opAanbod = (e: Event) => { e.preventDefault(); setAanbod(e as InstallEvent) }
    const opGeinstalleerd = () => setAanbod(null)
    window.addEventListener('beforeinstallprompt', opAanbod)
    window.addEventListener('appinstalled', opGeinstalleerd)
    return () => { window.removeEventListener('beforeinstallprompt', opAanbod); window.removeEventListener('appinstalled', opGeinstalleerd) }
  }, [])
  if (!aanbod) return null
  async function installeer() {
    await aanbod!.prompt()
    await aanbod!.userChoice
    setAanbod(null)
  }
  return (
    <div className="installeer">
      <p>Installeer De Rol als app. Na één keer openen werkt hij ook zonder internet.</p>
      <button className="knop stil" onClick={installeer}>Installeer als app</button>
    </div>
  )
}

function leesTab(): Tab {
  return location.hash === '#termijnen' ? 'termijnen' : 'stukken'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(leesTab)

  useEffect(() => {
    const opHash = () => setTab(leesTab())
    window.addEventListener('hashchange', opHash)
    return () => window.removeEventListener('hashchange', opHash)
  }, [])

  function kies(t: Tab) {
    history.replaceState(null, '', t === 'termijnen' ? '#termijnen' : '#')
    setTab(t)
  }

  return (
    <div className="pagina">
      <header className="kop">
        <div className="kop-binnen">
          <a className="merk" href="#" onClick={(e) => { e.preventDefault(); kies('stukken') }}>
            {/* Beeldmerk: een bef met de kraag van de toga. */}
            <svg viewBox="0 0 32 32" aria-hidden="true" className="merk-teken">
              <path d="M13.4 8.6h5.2l-.7 2.6h-3.8Z" />
              <path d="M15.2 11.2h-2.6l-1.5 16.3h3.6Z" />
              <path d="M16.8 11.2h2.6l1.5 16.3h-3.6Z" />
              <path d="M9 5.5c1.6 1.8 3.2 3 4.4 3.1M23 5.5c-1.6 1.8-3.2 3-4.4 3.1" />
            </svg>
            <span className="merk-tekst">
              <span className="merk-naam">De Rol</span>
              <span className="merk-sub">Stukken en termijnen voor de rol</span>
            </span>
          </a>
          <nav className="schakelaar" aria-label="Onderdelen">
            <button aria-current={tab === 'stukken' ? 'page' : undefined} onClick={() => kies('stukken')}>Stukken<span className="breed"> controleren</span></button>
            <button aria-current={tab === 'termijnen' ? 'page' : undefined} onClick={() => kies('termijnen')}>Termijnen</button>
          </nav>
          <ThemaKnop />
        </div>
      </header>

      <main className="inhoud">{tab === 'stukken' ? <Stukken /> : <Termijnen />}</main>

      <footer className="voet">
        <Installeer />
        <p className="maker">
          <span>Een product van</span>
          <a href="https://legal-pace.com" className="legal-pace"><LegalPaceLogo />Legal Pace</a>
        </p>
        <p className="voet-tekst">
          Gebaseerd op het{' '}
          <a href="https://www.rechtspraak.nl/binaries/_rts_1790839394209/content/assets/uit/lov/pr/lov-pr-civiele-dagvaardingszaken-rechtbanken-kanton-en-handel-2e-versie-1-juli-2026.pdf" target="_blank" rel="noreferrer">
            Landelijk procesreglement civiele dagvaardingszaken rechtbanken
          </a>
          , tweede versie van 1 juli 2026, handelszaken. De controles zijn een hulpmiddel; de advocaat blijft verantwoordelijk voor wat wordt ingediend.
        </p>
      </footer>
    </div>
  )
}
