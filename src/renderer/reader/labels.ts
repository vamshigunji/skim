// Printed page labels. `offset` means "printed page 1 is PDF page N" (1-based), set by the user
// when the PDF has no /PageLabels. Pages before N have no label.
export function labelsFor(pdfLabels: string[] | null, count: number, offset?: number): (string | null)[] {
  if (pdfLabels) return pdfLabels
  return Array.from({ length: count }, (_, i) => {
    const printed = i + 2 - (offset ?? 1)
    return printed >= 1 ? String(printed) : null
  })
}

// Go-to input: printed label first, `#N` for a PDF index, bare number falls back to a PDF index.
export function parseGoto(input: string, labels: (string | null)[]): number | null {
  const s = input.trim()
  const byIndex = (n: string) => (/^\d+$/.test(n) && +n >= 1 && +n <= labels.length ? +n - 1 : null)
  if (s.startsWith('#')) return byIndex(s.slice(1))
  const i = labels.indexOf(s)
  return i >= 0 ? i : byIndex(s)
}
