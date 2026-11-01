export type Status = 'ok' | 'let-op' | 'fout' | 'info'

export type Bevinding = {
  status: Status
  titel: string
  uitleg?: string
  bron?: string
}

export type Soort = 'processtuk' | 'productie'

export type Stuk = {
  id: string
  bestand: File
  naam: string
  grootte: number
  soort: Soort
  bezig: boolean
  paginas?: number
  bevindingen: Bevinding[]
  tekstPerPagina?: string[]
}
