import { useEffect, useRef, useState } from 'react'
import type { AskMessage } from '../../shared/types/ai'

// Grounded Ask over one paper (path) or a set of papers. The live answer is built from deltas in the same shape as a stored message,
// so one renderer handles both. Used by the Reader side panel and the Library cross-paper panel.
export function useAsk(scope: { path?: string; paperIds?: string[] }) {
  const [messages, setMessages] = useState<AskMessage[]>([])
  const [live, setLive] = useState<AskMessage | null>(null)
  const asking = useRef<string | null>(null)
  const reload = () => window.skim?.ai.thread(scope.path).then(setMessages)
  useEffect(() => {
    reload()
  }, [scope.path])

  const ask = (question: string, selection?: string | null) => {
    const requestId = crypto.randomUUID()
    const msg: AskMessage = { id: requestId, role: 'assistant', content: '', citations: [] }
    setMessages((m) => [...m, { id: `${requestId}-q`, role: 'user', content: question, citations: [], scope: scope.paperIds }])
    setLive({ ...msg })
    asking.current = requestId
    const end = () => {
      asking.current = null
      setLive(null)
      reload()
    }
    window.skim?.ai
      .askGrounded({ requestId, path: scope.path, paperIds: scope.paperIds, question, selection }, (d) => {
        if (d.type === 'text') msg.content += d.text
        else if (d.type === 'citation') {
          msg.citations = [...msg.citations, d.citation]
          msg.content += `[[c:${d.citation.n} "${d.citation.quote}"]]`
        } else if (d.type === 'state') msg.state = d.state
        else if (d.type === 'coverage') msg.coverage = d.coverage
        else if (d.type === 'error') msg.content += `\n[${d.message}]`
        setLive({ ...msg })
        if (d.type === 'done' || d.type === 'error') end()
      })
      .then((r) => {
        if ('needsConfirmation' in r) {
          msg.content = `[${r.providerId} is a hosted provider. Confirm once in Settings what gets sent, then ask again.]`
          setLive({ ...msg })
          asking.current = null
        }
      })
      .catch((e: Error) => {
        msg.content = `[${e.message}]`
        setLive({ ...msg })
        asking.current = null
      })
  }
  const stop = () => asking.current && window.skim?.ai.cancel(asking.current)
  return { messages, live, ask, stop }
}
