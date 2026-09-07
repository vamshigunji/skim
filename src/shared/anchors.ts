// Model output anchor: [[c:<n> "<quote>"]]. Parser buffers from "[[c:" until "]]" so a partial anchor never reaches the renderer.
export type Segment = { text: string } | { n: number; quote: string }

const ANCHOR = /^\[\[c:(\d+) "([^"]*)"\]\]$/

const parseAnchor = (raw: string): Segment => {
  const m = ANCHOR.exec(raw)
  return m ? { n: +m[1], quote: m[2] } : { text: raw }
}

export function createAnchorParser() {
  let buf = ''
  const drain = (final: boolean): Segment[] => {
    const out: Segment[] = []
    while (buf) {
      const open = buf.indexOf('[[')
      if (open < 0) {
        out.push({ text: buf })
        buf = ''
        break
      }
      if (open > 0) out.push({ text: buf.slice(0, open) })
      const close = buf.indexOf(']]', open)
      if (close < 0) {
        // Might still be growing. Hold unless it cannot be an anchor or the stream ended.
        const rest = buf.slice(open)
        if (final || !'[[c:'.startsWith(rest.slice(0, 4))) {
          out.push({ text: rest })
          buf = ''
        } else buf = rest
        break
      }
      out.push(parseAnchor(buf.slice(open, close + 2)))
      buf = buf.slice(close + 2)
    }
    return out
  }
  return {
    push(text: string) {
      buf += text
      return drain(false)
    },
    flush: () => drain(true),
  }
}

export const splitAnchors = (text: string) => {
  const p = createAnchorParser()
  return [...p.push(text), ...p.flush()]
}
