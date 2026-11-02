import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Schrijft na de build een service worker (sw.js) met de lijst van alle bestanden van de site.
// De browser bewaart die bestanden, zodat De Rol na één keer openen ook zonder internet werkt.
function offline(): Plugin {
  return {
    name: 'de-rol-offline',
    apply: 'build',
    generateBundle(_, bundle) {
      const publiek = readdirSync('public').filter((f) => f !== 'sw.js')
      const bestanden = ['/', ...publiek.map((f) => '/' + f), ...Object.keys(bundle).filter((f) => f !== 'index.html').map((f) => '/' + f)]
      const versie = createHash('sha256').update(bestanden.join('\n')).digest('hex').slice(0, 12)
      const code = `// Gemaakt bij de build (vite.config.ts). Niet met de hand aanpassen.
const CACHE = 'de-rol-${versie}'
const BESTANDEN = ${JSON.stringify(bestanden, null, 2)}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BESTANDEN)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((namen) => Promise.all(namen.filter((n) => n.startsWith('de-rol-') && n !== CACHE).map((n) => caches.delete(n)))))
})

self.addEventListener('fetch', (e) => {
  const verzoek = e.request
  if (verzoek.method !== 'GET' || new URL(verzoek.url).origin !== location.origin) return
  if (verzoek.mode === 'navigate') {
    // Pagina: eerst online proberen (nieuwste versie), anders de bewaarde versie.
    e.respondWith(fetch(verzoek).then((antwoord) => {
      const kopie = antwoord.clone()
      caches.open(CACHE).then((c) => c.put('/', kopie))
      return antwoord
    }).catch(() => caches.match('/', { ignoreVary: true })))
    return
  }
  // Overige bestanden hebben een unieke naam per versie: eerst uit de bewaarde kopie.
  e.respondWith(caches.match(verzoek, { ignoreVary: true }).then((bewaard) => bewaard || fetch(verzoek).then((antwoord) => {
    if (antwoord.ok) { const kopie = antwoord.clone(); caches.open(CACHE).then((c) => c.put(verzoek, kopie)) }
    return antwoord
  })))
})
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code })
    },
  }
}

export default defineConfig({
  plugins: [react(), offline()],
})
