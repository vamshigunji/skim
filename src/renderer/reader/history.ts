type Entry = { undo: () => void; redo: () => void }

// Per-document undo stack. Requirement 8 in features/02 asks for at least 200 steps.
export function createHistory(depth = 200) {
  const past: Entry[] = []
  let future: Entry[] = []
  return {
    push(e: Entry) {
      past.push(e)
      if (past.length > depth) past.shift()
      future = []
    },
    undo() {
      const e = past.pop()
      if (!e) return false
      e.undo()
      future.push(e)
      return true
    },
    redo() {
      const e = future.pop()
      if (!e) return false
      e.redo()
      past.push(e)
      return true
    },
  }
}
