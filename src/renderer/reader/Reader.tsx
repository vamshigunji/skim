import { useEffect, useRef, useState } from 'react'
import { labelsFor, parseGoto } from '../../shared/labels'
import { loadPdf, type PdfDoc } from './pdf'
import { loadPosition, savePosition } from './position'
import type { SearchHit, SearchOptions } from '../../shared/types/search'

interface Props {
  path: string
  data: Uint8Array
  initialPage?: number
}

const ZOOM_STEP = 1.25

export function Reader({ path, data, initialPage }: Props) {
  const saved = loadPosition(path)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [page, setPage] = useState(initialPage ?? saved?.page ?? 0)
  const [zoom, setZoom] = useState(saved?.zoom ?? 1)
  const [offset, setOffset] = useState(saved?.offset)
  const [tab, setTab] = useState<'pages' | 'outline' | 'search'>('pages')
  const [toast, setToast] = useState<string | null>(null)
  const [goto, setGoto] = useState('')
  const [find, setFind] = useState('')
  const [opts, setOpts] = useState<SearchOptions>({})
  const [hits, setHits] = useState<SearchHit[]>([])
  const [cur, setCur] = useState(0)
  const [searched, setSearched] = useState('')
  const findRef = useRef<HTMLInputElement>(null)
  const pages = useRef<(HTMLDivElement | null)[]>([])
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPdf(data).then(setDoc)
  }, [data])

  useEffect(() => {
    savePosition(path, { page, zoom, offset })
  }, [path, page, zoom, offset])

  const labels = doc ? labelsFor(doc.labels, doc.numPages, offset) : []
  const label = (i: number) => labels[i] ?? `#${i + 1}`

  const jump = (i: number) => {
    if (!doc || i < 0 || i >= doc.numPages) return
    setPage(i)
    pages.current[i]?.scrollIntoView()
    setToast(`p. ${label(i)}`)
    setTimeout(() => setToast(null), 1200)
  }

  useEffect(() => {
    if (doc) pages.current[page]?.scrollIntoView()
  }, [doc])

  useEffect(() => {
    if (initialPage !== undefined) jump(initialPage)
  }, [initialPage])

  const runFind = (dir: 1 | -1 = 1) => {
    if (find !== searched || !hits.length) {
      window.skim?.search({ query: find, options: opts, path }).then((h) => {
        setHits(h)
        setSearched(find)
        setCur(0)
        if (h[0]) jump(h[0].page_index)
      })
    } else {
      const n = (cur + dir + hits.length) % hits.length
      setCur(n)
      jump(hits[n].page_index)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        setTab('search')
        setTimeout(() => findRef.current?.focus())
        e.preventDefault()
        return
      }
      if (e.target instanceof HTMLInputElement || e.metaKey) return
      if (e.key === ' ' || e.key === 'PageDown') jump(page + (e.shiftKey ? -1 : 1))
      else if (e.key === 'PageUp') jump(page - 1)
      else if (e.key === '+' || e.key === '=') setZoom((z) => z * ZOOM_STEP)
      else if (e.key === '-') setZoom((z) => z / ZOOM_STEP)
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const onScroll = () => {
    const top = scroller.current!.getBoundingClientRect().top
    const i = pages.current.findIndex((el) => el && el.getBoundingClientRect().bottom > top + 40)
    if (i >= 0 && i !== page) setPage(i)
  }

  if (!doc) return <p className="p-8 text-muted">Opening…</p>

  return (
    <div className="flex h-full min-h-0">
      <aside className={`flex ${tab === 'search' ? 'w-[260px]' : 'w-[140px]'} shrink-0 flex-col border-r border-line bg-panel text-[9px]`}>
        <div className="flex gap-1 p-2">
          {(['pages', 'outline', 'search'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-1 font-bold ${tab === t ? 'bg-active text-text' : 'text-muted'}`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          {tab === 'pages' &&
            Array.from({ length: doc.numPages }, (_, i) => (
              <button
                key={i}
                data-testid="thumbnail"
                onClick={() => jump(i)}
                className={`mb-2 block w-full border-2 ${i === page ? 'border-accent' : 'border-transparent'}`}
              >
                <PageCanvas doc={doc} index={i} scale={0.15} />
                <span className={`block text-center ${i === page ? 'text-accent' : 'text-muted'}`}>{label(i)}</span>
              </button>
            ))}
          {tab === 'outline' &&
            (doc.outline.length ? (
              doc.outline.map((o, k) => (
                <button key={k} onClick={() => jump(o.pageIndex)} className="block w-full py-1 text-left text-[11px] text-text-2 hover:text-text">
                  {o.title}
                </button>
              ))
            ) : (
              <p className="py-2 text-muted">No outline</p>
            ))}
          {tab === 'search' && (
            <div className="flex flex-col gap-2 py-1 text-[11px]">
              <input
                ref={findRef}
                value={find}
                placeholder="Find in document"
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runFind(e.shiftKey ? -1 : 1)}
                className="w-full rounded bg-raised px-2 py-1.5 placeholder:text-muted"
              />
              <div className="flex items-center gap-1">
                {(
                  [
                    ['Aa', 'caseSensitive', 'Match case'],
                    ['W', 'wholeWord', 'Whole word'],
                    ['.*', 'regex', 'Regex'],
                  ] as const
                ).map(([txt, key, name]) => (
                  <button
                    key={key}
                    aria-label={name}
                    aria-pressed={!!opts[key]}
                    onClick={() => {
                      setOpts({ ...opts, [key]: !opts[key] })
                      setSearched('')
                    }}
                    className={`rounded px-1.5 py-0.5 font-bold ${opts[key] ? 'bg-active text-accent' : 'text-muted'}`}
                  >
                    {txt}
                  </button>
                ))}
                <span data-testid="hit-count" className="ml-auto text-muted">
                  {hits.length ? `${cur + 1} / ${hits.length}` : searched ? '0 / 0' : ''}
                </span>
              </div>
              {hits.map((h, k) => (
                <button
                  key={k}
                  onClick={() => {
                    setCur(k)
                    jump(h.page_index)
                  }}
                  className={`truncate rounded px-1 py-1 text-left ${k === cur ? 'bg-active text-text' : 'text-text-2'}`}
                >
                  <span className="mr-2 font-semibold text-accent">p. {h.label}</span>
                  {h.before}
                  <mark className="bg-amber/40 text-text">{h.match}</mark>
                  {h.after}
                </button>
              ))}
              <p className="text-muted">ENTER next     SHIFT+ENTER previous</p>
            </div>
          )}
        </div>
        {!doc.labels && (
          <label className="flex items-center gap-1 border-t border-line p-2 text-muted">
            1 = #
            <input
              type="number"
              min={1}
              aria-label="Printed page 1 is PDF page"
              value={offset ?? 1}
              onChange={(e) => setOffset(+e.target.value || 1)}
              className="w-10 rounded bg-raised px-1 text-text"
            />
          </label>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-line px-4 text-[11px]">
          <span data-testid="page-counter" className="font-semibold">
            P. {label(page)} / {doc.numPages}
          </span>
          <input
            value={goto}
            placeholder="Go to page"
            onChange={(e) => setGoto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              const i = parseGoto(goto, labels)
              if (i === null) setToast('No such page')
              else jump(i)
              setGoto('')
            }}
            className="w-28 rounded bg-raised px-2 py-1 placeholder:text-muted"
          />
          <span className="ml-auto text-muted">{Math.round(zoom * 100)}%</span>
          <button aria-label="Zoom out" onClick={() => setZoom((z) => z / ZOOM_STEP)} className="px-1">−</button>
          <button aria-label="Zoom in" onClick={() => setZoom((z) => z * ZOOM_STEP)} className="px-1">+</button>
          <button
            onClick={() => doc.getPage(page).then((p) => setZoom((scroller.current!.clientWidth - 48) / p.getViewport({ scale: 1 }).width))}
            className="text-accent"
          >
            FIT
          </button>
        </div>
        <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-auto bg-bg p-6">
          {Array.from({ length: doc.numPages }, (_, i) => (
            <div key={i} ref={(el) => {
              pages.current[i] = el
            }} className="mx-auto mb-4 w-fit shadow-lg">
              <PageCanvas doc={doc} index={i} scale={zoom} />
            </div>
          ))}
        </div>
        {toast && (
          <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 rounded bg-raised px-3 py-1 text-[11px] text-text">{toast}</div>
        )}
        <p className="h-6 shrink-0 px-4 text-[10px] leading-6 text-muted">SPACE next page     PAGEUP previous     + / − zoom</p>
      </div>
    </div>
  )
}

function PageCanvas({ doc, index, scale }: { doc: PdfDoc; index: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let cancelled = false
    doc.getPage(index).then((p) => {
      const canvas = ref.current
      const ctx = canvas?.getContext('2d')
      if (cancelled || !canvas || !ctx) return
      const dpr = window.devicePixelRatio || 1
      const vp = p.getViewport({ scale: scale * dpr })
      canvas.width = vp.width
      canvas.height = vp.height
      canvas.style.width = `${vp.width / dpr}px`
      canvas.style.height = `${vp.height / dpr}px`
      p.render({ canvasContext: ctx, viewport: vp, canvas })
    })
    return () => {
      cancelled = true
    }
  }, [doc, index, scale])
  return <canvas ref={ref} className="bg-paper" />
}
