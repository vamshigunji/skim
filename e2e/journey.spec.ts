import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { startFakeServer } from '../src/main/services/ai/fake-server'

const fixture = resolve('e2e/fixtures/sample.pdf')

// The whole promise in one session (README, PRD): import, read, highlight, ask, verify the source, export.
// The model server is on 127.0.0.1, standing in for the default local Ollama, so nothing leaves the machine.
test('import a PDF, read it, highlight a passage, ask a question, click the citation to land on the source, export a note with a citekey', async () => {
  const fake = await startFakeServer()
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js'], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  await expect(page.getByText('Drop PDFs here')).toBeVisible()

  // Import, and let the index.status broadcast refresh the list.
  await page.evaluate((p) => window.skim!.library.import([p]), fixture)
  const row = page.getByTestId('paper-row')
  await expect(row).toHaveCount(1)

  // Read.
  await row.getByRole('button').first().click()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')

  // Highlight a passage.
  const word = page.locator('.textLayer span').filter({ hasText: 'attention' }).first()
  const box = (await word.boundingBox())!
  await word.dblclick({ position: { x: box.width - 6, y: box.height / 2 } })
  await expect(page.locator('[data-annotation-id]')).toHaveCount(1)

  // Point the local-only provider at the stand-in server.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('openai base URL').fill(fake.url)
  await page.getByLabel('openai model').fill('grounded-model')
  await page.getByLabel('openai API key').fill('sk-e2e')
  await page.getByRole('button', { name: 'Save openai key' }).click()
  await page.getByRole('button', { name: 'Make openai default' }).click()
  await page.getByRole('button', { name: 'Test openai' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByTestId('test-output')).toContainText('scaled dot products')

  // Ask, then click the citation to land on the highlighted source passage.
  await page.getByRole('button', { name: 'Reading', exact: true }).click()
  await page.getByRole('button', { name: 'ASK', exact: true }).click()
  const ask = page.getByPlaceholder('Ask about this paper')
  await ask.fill('How is attention computed?')
  await ask.press('Enter')
  await expect(page.getByTestId('answer-state')).toHaveText('PARTIAL')
  const chip = page.getByTestId('citation-chip').first()
  await expect(chip).toContainText('p. 1173')
  await chip.click()
  await expect(page.getByTestId('page-counter')).toHaveText('P. 1173 / 3')
  await expect(page.locator('[data-flash]')).toHaveCount(1)

  // Export the note with its citekey and page link. The save dialog is native, so the path is given.
  await page.getByRole('button', { name: 'Notes' }).click()
  await expect(page.getByTestId('note')).toHaveCount(1)
  const out = join(userData, 'notes.md')
  const written = await page.evaluate(
    ([path]) => window.skim!.notes.list().then((n) => window.skim!.notes.export({ paperId: n[0].paper_id, ids: [n[0].id], style: 'pandoc', path })),
    [out],
  )
  expect(written).toMatchObject({ count: 1 })
  const md = readFileSync(out, 'utf8')
  expect(md).toMatch(/^citekey: [a-z0-9]+$/m)
  expect(md).toMatch(/\[@[a-z0-9]+, p\. 1173\]/)
  expect(md).toContain('skim://paper/')

  await app.close()
  await fake.close()
})
