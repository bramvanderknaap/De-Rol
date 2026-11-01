import { useEffect, useState } from 'react'
import Stukken from './components/Stukken'
import Termijnen from './components/Termijnen'

type Tab = 'stukken' | 'termijnen'

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
            <svg viewBox="0 0 24 24" aria-hidden="true" className="merk-teken">
              <rect x="4" y="2.5" width="12" height="19" rx="1.5" />
              <rect x="16" y="5.5" width="3.5" height="5" rx="1" />
              <rect x="16" y="12" width="3.5" height="5" rx="1" />
            </svg>
            De Rol
          </a>
          <nav className="schakelaar" aria-label="Onderdelen">
            <button aria-current={tab === 'stukken' ? 'page' : undefined} onClick={() => kies('stukken')}>Stukken controleren</button>
            <button aria-current={tab === 'termijnen' ? 'page' : undefined} onClick={() => kies('termijnen')}>Termijnen</button>
          </nav>
        </div>
      </header>

      <main className="inhoud">{tab === 'stukken' ? <Stukken /> : <Termijnen />}</main>

      <footer className="voet">
        <p>
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
