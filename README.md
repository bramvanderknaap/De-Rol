# De Rol

Hulpmiddel voor de rolmedewerker in civiele handelszaken bij de rechtbank.

- **Stukken controleren**: controleert pdf's tegen het Landelijk procesreglement civiele dagvaardingszaken rechtbanken (tweede versie, 1 juli 2026) en de eisen van Mijn Rechtspraak: PDF/A, maximaal 25 MB, bestandsnaam, A4, marges, lettergrootte, regelafstand, omvang (art. 2.13) en nummering van producties (art. 2.14, bijlage II).
- **Termijnen**: berekent uiterste data per proceshandeling, met feestdagen volgens art. 3 Algemene termijnenwet.

Alle controles draaien in de browser. Bestanden worden niet geüpload of opgeslagen; de Content-Security-Policy in `index.html` staat alleen verbindingen met de eigen site toe.

## Ontwikkelen

```
npm install
npm run dev      # lokaal starten
npm test         # tests
npm run build    # productieversie in dist/
```

Code: `src/lib/analyse.ts` (pdf-controles), `src/lib/termijnen.ts` (termijnen met artikel en citaat), `src/lib/datum.ts` (feestdagen en werkdagen), `src/lib/bestandsnaam.ts` (namen en nummering).
