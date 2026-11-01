// Verwijzingen naar producties in een processtuk: "productie 3", "producties 4 en 5", "productie 6 t/m 9".
export function genoemdeProducties(tekst: string): Set<number> {
  const uit = new Set<number>()
  const re = /producties?\s+((?:\d+\s*(?:,|en|t\/m|tot en met|-|–)?\s*)+)/gi
  for (const m of tekst.matchAll(re)) {
    const deel = m[1]
    const bereik = /(\d+)\s*(?:t\/m|tot en met|-|–)\s*(\d+)/g
    for (const b of deel.matchAll(bereik)) {
      const [van, tot] = [Number(b[1]), Number(b[2])]
      if (tot >= van && tot - van < 200) for (let i = van; i <= tot; i++) uit.add(i)
    }
    for (const n of deel.matchAll(/\d+/g)) uit.add(Number(n[0]))
  }
  return uit
}
