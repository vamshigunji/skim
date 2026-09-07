import { useEffect, useRef, useState } from 'react'
import 'pdfjs-dist/web/pdf_viewer.css'
import { toFractions, type FracRect } from '../../shared/annot'
import { labelsFor, parseGoto } from '../../shared/labels'
import type { Annotation } from '../../shared/types/db'
import type { SearchHit, SearchOptions } from '../../shared/types/search'
import { AnnotationLayer } from './AnnotationLayer'
import { AnnotationsPanel, isShown, type Filter } from './AnnotationsPanel'
import { createHistory } from './history'
import { loadPdf, renderTextLayer, type PdfDoc } from './pdf'
import { loadPalette, savePalette, type Palette } from './palette'
import { loadPosition, savePosition } from './position'

interface Props {
  path: string
  data: Uint8Array
  initialPage?: number
}

type Mark = 'highlight' | 'underline' | 'strike'
type Tool = 'select' | Mark
const marks: [Mark, string][] = [
  ['highlight', 'H'],
  ['underline', 'U'],
  ['strike', 'S'],
]
const ZOOM_STEP = 1.25

export function Reader({ path, data, initialPage }: Props) {
  const saved = loadPosition(path)
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [page, setPage] = useState(initialPage ?? saved?.page ?? 0)
  const [zoom, setZoom] = useState(saved?.zoom ?? 1)
  const [offset, setOffset] = useState(saved?.offset)
  const [filter, setFilter] = useState<Filter>(saved?.filter ?? { colors: [], kinds: [] })
  const [tab, setTab] = useState<'pages' | 'outline' | 'search'>('pages')
  const [toast, setToast] = useState<string | null>(null)
  const [goto, setGoto] = useState('')
  const [find, setFind] = useState('')
  const [opts, setOpts] = useState<SearchOptions>({})
  const [hits, setHits] = useState<SearchHit[]>([])
  const [cur, setCur] = useState(0)
  const [searched, setSearched] = useState('')
  const [annots, setAnnots] = useState<Annotation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [palette, setPalette] = useState<Palette>(loadPalette)
  const [colorIdx, setColorIdx] = useState(0)
  const [bar, setBar] = useState<{ x: number; y: number; page: number; rects: FracRect[]; text: string } | null>(null)
  const findRef = useRef<HTMLInputElement>(null)
  const pages = useRef<(HTMLDivElement | null)[]>([])
  const scroller = useRef<HTMLDivElement>(null)
  const history = useRef(createHistory()).current
  const color = palette[colorIdx]?.color ?? palette[0].color

  useEffect(() => {
    loadPdf(data).then(setDoc)
    window.skim?.annotations.list(path).then(setAnnots)
  }, [data, path])

  useEffect(() => {
    savePosition(path, { page, zoom, offset, filter })
  }, [path, page, zoom, offset, filter])

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

  // Annotation persistence: local state first, then the sidecar through IPC. Every change is undoable.
  const put = (a: Annotation) => {
    setAnnots((prev) => [...prev.filter((x) => x.id !== a.id), a])
    window.skim?.annotations.upsert(path, a)
  }
  const drop = (id: string) => {
    setAnnots((prev) => prev.filter((x) => x.id !== id))
    window.skim?.annotations.delete(id)
  }
  const add = (a: Annotation) => {
    put(a)
    history.push({ undo: () => drop(a.id), redo: () => put(a) })
  }
  const del = (id: string) => {
    const a = annots.find((x) => x.id === id)
    if (!a) return
    drop(id)
    setSelected(null)
    history.push({ undo: () => put(a), redo: () => drop(id) })
  }
  const change = (id: string, patch: Partial<Annotation>) => {
    const prev = annots.find((x) => x.id === id)
    if (!prev) return
    const next = { ...prev, ...patch, updated_at: Date.now() }
    put(next)
    history.push({ undo: () => put(prev), redo: () => put(next) })
  }
  const commit = (pageIndex: number, rects: FracRect[], text: string, kind: Mark) => {
    const now = Date.now()
    const a: Annotation = { id: crypto.randomUUID(), attachment_id: '', page_index: pageIndex, kind, rects_json: JSON.stringify(rects), color, text, comment: null, label: null, hidden: 0, source: 'user', created_at: now, updated_at: now }
    add(a)
    setBar(null)
    window.getSelection()?.removeAllRanges()
    return a.id
  }

  const onSelection = (force?: Mark) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const node = range.commonAncestorContainer
    const pageEl = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-page]')
    if (!pageEl) return
    const pageIndex = +pageEl.dataset.page!
    const rects = toFractions([...range.getClientRects()], pageEl.getBoundingClientRect())
    const text = sel.toString().trim()
    if (!rects.length || !text) return
    const kind = force ?? (tool === 'select' ? null : tool)
    if (kind) return commit(pageIndex, rects, text, kind)
    const r = range.getBoundingClientRect()
    const s = scroller.current!.getBoundingClientRect()
    setBar({ x: r.left - s.left + scroller.current!.scrollLeft, y: r.top - s.top + scroller.current!.scrollTop - 34, page: pageIndex, rects, text })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        setTab('search')
        setTimeout(() => findRef.current?.focus())
        e.preventDefault()
        return
      }
      if (e.metaKey && e.key === 'z') {
        if (e.shiftKey) history.redo()
        else history.undo()
        e.preventDefault()
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.metaKey) return
      if (e.key === 'Escape') {
        setSelected(null)
        setBar(null)
        setTool('select')
        window.getSelection()?.removeAllRanges()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) del(selected)
      else if (e.key === ' ' || e.key === 'PageDown') jump(page + (e.shiftKey ? -1 : 1))
      else if (e.key === 'PageUp') jump(page - 1)
      else if (e.key === '+' || e.key === '=') setZoom((z) => z * ZOOM_STEP)
      else if (e.key === '-') setZoom((z) => z / ZOOM_STEP)
      else if (e.key === 'h') setTool('highlight')
      else if (e.key === 'u') setTool('underline')
      else if (e.key === 's') setTool('strike')
      else if (/^[1-9]$/.test(e.key) && palette[+e.key - 1]) setColorIdx(+e.key - 1)
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

  const swatch = (c: string, k: number) => (
    <button
      key={c}
      aria-label={palette[k].name}
      aria-pressed={k === colorIdx}
      onClick={() => setColorIdx(k)}
      className={`h-4 w-4 rounded-sm ${k === colorIdx ? 'ring-2 ring-accent ring-offset-1 ring-offset-panel' : ''}`}
      style={{ background: c }}
    />
  )

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
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} title="Active color" />
          <span className="text-muted">{tool === 'select' ? 'SELECT' : tool.toUpperCase()}</span>
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
        <div ref={scroller} onScroll={onScroll} onMouseUp={() => onSelection()} onDoubleClick={() => onSelection('highlight')} className="relative min-h-0 flex-1 overflow-auto bg-bg p-6">
          {Array.from({ length: doc.numPages }, (_, i) => (
            <div
              key={i}
              data-page={i}
              ref={(el) => {
                pages.current[i] = el
              }}
              onClick={() => setSelected(null)}
              className="relative mx-auto mb-4 w-fit shadow-lg"
            >
              <PageCanvas doc={doc} index={i} scale={zoom} text />
              <AnnotationLayer annotations={annots.filter((a) => a.page_index === i && isShown(a, filter))} selectedId={selected} onSelect={setSelected} />
            </div>
          ))}
          {bar && (
            <div data-testid="selection-bar" className="absolute z-10 flex gap-1 rounded bg-raised p-1 text-[10px] shadow-lg" style={{ left: bar.x, top: bar.y }} onMouseUp={(e) => e.stopPropagation()}>
              {marks.map(([kind, key]) => (
                <button key={kind} onClick={() => commit(bar.page, bar.rects, bar.text, kind)} className="rounded px-2 py-1 font-bold text-text hover:bg-active">
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
                  {kind.toUpperCase()} <span className="text-muted">{key}</span>
                </button>
              ))}
              <button onClick={() => setSelected(commit(bar.page, bar.rects, bar.text, 'highlight'))} className="rounded px-2 py-1 font-bold text-text hover:bg-active">
                COMMENT
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(bar.text)
                  setBar(null)
                }}
                className="rounded px-2 py-1 font-bold text-text hover:bg-active"
              >
                COPY
              </button>
            </div>
          )}
        </div>
        {toast && (
          <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 rounded bg-raised px-3 py-1 text-[11px] text-text">{toast}</div>
        )}
        <p className="h-6 shrink-0 px-4 text-[10px] leading-6 text-muted">SPACE next     H / U / S mark     1-9 color     DEL remove     ⌘Z undo     ESC select</p>
      </div>

      <aside className="flex w-[260px] shrink-0 flex-col gap-3 border-l border-line bg-panel p-3 text-[11px]">
        <div className="flex items-center gap-2">
          {marks.map(([kind, key]) => (
            <button
              key={kind}
              aria-pressed={tool === kind}
              onClick={() => setTool(tool === kind ? 'select' : kind)}
              className={`rounded px-2 py-1 font-bold ${tool === kind ? 'bg-active text-accent' : 'text-muted'}`}
            >
              {key}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5">
            {palette.map((p, k) => swatch(p.color, k))}
            {palette.length < 12 && (
              <input
                type="color"
                aria-label="Add color"
                onChange={(e) => {
                  const next = [...palette, { color: e.target.value.toUpperCase(), name: e.target.value.toUpperCase() }]
                  setPalette(next)
                  savePalette(next)
                }}
                className="h-4 w-4 cursor-pointer rounded-sm border-0 bg-transparent p-0"
              />
            )}
          </span>
        </div>
        <AnnotationsPanel annotations={annots} palette={palette} filter={filter} selectedId={selected} onFilter={setFilter} onSelect={setSelected} onComment={(id, comment) => change(id, { comment })} />
      </aside>
    </div>
  )
}

function PageCanvas({ doc, index, scale, text }: { doc: PdfDoc; index: number; scale: number; text?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
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
      if (text && textRef.current) renderTextLayer(p, textRef.current, scale)
    })
    return () => {
      cancelled = true
    }
  }, [doc, index, scale, text])
  return (
    <div className="relative">
      <canvas ref={ref} className="bg-paper" />
      {text && <div ref={textRef} className="textLayer" />}
    </div>
  )
}
