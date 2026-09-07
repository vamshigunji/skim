import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFPageProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'

if (typeof Worker !== 'undefined') pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfDoc {
  numPages: number
  labels: string[] | null
  outline: { title: string; pageIndex: number }[]
  getPage: (index: number) => Promise<PDFPageProxy>
}

export async function loadPdf(data: Uint8Array): Promise<PdfDoc> {
  const doc = await pdfjs.getDocument({ data }).promise
  const outline: PdfDoc['outline'] = []
  for (const item of (await doc.getOutline()) ?? []) {
    const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest
    if (dest?.[0]) outline.push({ title: item.title, pageIndex: await doc.getPageIndex(dest[0]) })
  }
  return {
    numPages: doc.numPages,
    labels: await doc.getPageLabels(),
    outline,
    getPage: (i) => doc.getPage(i + 1),
  }
}
