# Skim

An AI-native desktop PDF reader for researchers. Local first: reading, exact search, annotations, notes, and export work with no network. AI features default to a local Ollama model, and every AI claim carries a page citation verified against the extracted text.

## Install

Requires Node 24 or newer (the bundled `node:sqlite` is the database, so there are no native modules to build).

```
npm install
```

## Run

```
npm run dev      # development build with hot reload
npm run build    # production build into out/
npm start        # launch the built app
npm start -- path/to/paper.pdf   # open a PDF on launch
```

The library database lives in the Electron user-data folder as `library.db`. Set `SKIM_USER_DATA=/some/dir` to use another location.

AI: Ollama at `http://127.0.0.1:11434` is the default and needs a chat model (for example `ollama pull llama3.2`) and `nomic-embed-text` for cross-paper retrieval. Hosted providers are bring-your-own-key, stored in the OS keychain, and nothing is sent until you confirm the egress dialog once per provider. AI can be switched off in Settings; reading, search, annotations, and export keep working.

## Test

```
npm run typecheck
npm run lint
npm test             # Vitest unit tests
npm run test:e2e     # builds, then Playwright drives the real Electron app
```

Playwright specs run against fixtures in `e2e/fixtures` and a fake provider server, so no model or network is needed.

## Layout

- `src/main` Electron main: SQLite, import and indexing (extraction in a worker thread), search, annotations, references, notes and export, proposals with an undo journal, the AI service (providers, grounded ask, skim overlays, retrieval).
- `src/preload` the single `window.skim` bridge.
- `src/renderer` React UI: library, reader, notes, settings.
- `src/shared` pure logic used on both sides: verification, anchors, citations, export, proposals.
- `e2e` Playwright specs driving the built app, with PDF fixtures.
