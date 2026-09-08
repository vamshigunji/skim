import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'

if (typeof Worker !== 'undefined') pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfDoc {
  numPages: number
  labels: string[] | null
  outline: { title: string; pageIndex: number }[]
  sizes: { width: number; height: number }[] // points, scale 1
  getPage: (index: number) => Promise<PDFPageProxy>
}

// Transparent text spans over the canvas so the browser can select text. CSS from pdfjs-dist/web/pdf_viewer.css.
export function renderTextLayer(page: PDFPageProxy, container: HTMLElement, scale: number) {
  container.replaceChildren()
  container.style.setProperty('--scale-factor', String(scale))
  return new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container, viewport: page.getViewport({ scale }) }).render()
}

export async function loadPdf(data: Uint8Array): Promise<PdfDoc> {
  const doc = await pdfjs.getDocument({ data }).promise
  const outline: PdfDoc['outline'] = []
  for (const item of (await doc.getOutline()) ?? []) {
    const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest
    if (dest?.[0]) outline.push({ title: item.title, pageIndex: await doc.getPageIndex(dest[0]) })
  }
  const sizes = await Promise.all(Array.from({ length: doc.numPages }, async (_, i) => {
    const { width, height } = (await doc.getPage(i + 1)).getViewport({ scale: 1 })
    return { width, height }
  }))
  return {
    sizes,
    numPages: doc.numPages,
    labels: await doc.getPageLabels(),
    outline,
    getPage: (i) => doc.getPage(i + 1),
  }
}
