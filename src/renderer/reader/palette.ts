export type Palette = { color: string; name: string }[]

// Lexio's five defaults in Tokyo Night hues. Users may extend to 12 (features/02 requirement 1).
export const defaultPalette: Palette = [
  { color: '#E0AF68', name: 'Yellow' },
  { color: '#9ECE6A', name: 'Green' },
  { color: '#7AA2F7', name: 'Blue' },
  { color: '#F7768E', name: 'Pink' },
  { color: '#FF9E64', name: 'Orange' },
]

export const loadPalette = (): Palette => JSON.parse(localStorage.getItem('skim.palette') ?? 'null') ?? defaultPalette
export const savePalette = (p: Palette) => localStorage.setItem('skim.palette', JSON.stringify(p))
