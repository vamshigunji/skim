import { findMentions } from '../../shared/mentions'

// Wraps detected references inside text-layer spans so they can be hovered. Works without PDF link annotations.
export function markMentions(container: Element) {
  for (const span of container.querySelectorAll('span')) {
    const text = span.textContent ?? ''
    const found = findMentions(text)
    if (!found.length || span.querySelector('mark')) continue
    const frag = document.createDocumentFragment()
    let pos = 0
    for (const m of found) {
      frag.append(text.slice(pos, m.index))
      const mark = document.createElement('mark')
      mark.className = 'ref'
      mark.textContent = text.slice(m.index, m.index + m.length)
      if (m.kind === 'cite') mark.dataset.ref = m.keys[0]
      else mark.dataset.region = `${m.kind}:${m.keys[0]}`
      frag.append(mark)
      pos = m.index + m.length
    }
    frag.append(text.slice(pos))
    span.replaceChildren(frag)
  }
}
