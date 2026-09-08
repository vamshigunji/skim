import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface Probe {
  numPages: number
  labels: string[] | null
  info: Record<string, unknown>
  pages: { text: string; width: number; height: number; items: { str: string; x: number; y: number; w: number; h: number }[] }[]
  titleGuess: string | null
}
export type Extract = (data: Buffer) => Promise<Probe>

// Text, geometry, labels, and metadata for one PDF. Runs in a worker thread in the app (extract.worker.ts) and inline in tests.
export async function probe(data: Buffer): Promise<Probe> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const pages: Probe['pages'] = []
  let titleGuess: { str: string; height: number } | null = null
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const { width, height } = page.getViewport({ scale: 1 })
    const items = (await page.getTextContent()).items.filter((it) => 'str' in it)
    pages.push({
      text: items.map((it) => it.str + (it.hasEOL ? '\n' : '')).join(''),
      width,
      height,
      items: items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height })),
    })
    if (i === 1) for (const it of items) if (it.str.trim() && it.height > (titleGuess?.height ?? 0)) titleGuess = it
  }
  const { info } = await doc.getMetadata()
  return { numPages: doc.numPages, labels: await doc.getPageLabels(), info: info as Record<string, unknown>, pages, titleGuess: titleGuess?.str.trim() ?? null }
}
