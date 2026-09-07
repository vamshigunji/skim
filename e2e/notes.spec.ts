import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const fixture = resolve('e2e/fixtures/sample.pdf')

test('a highlight shows in Notes with its page label and citekey, filters, and exports Markdown idempotently', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js', fixture], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')
  const word = page.locator('.textLayer span').filter({ hasText: 'attention' }).first()
  const box = (await word.boundingBox())!
  await word.dblclick({ position: { x: box.width - 6, y: box.height / 2 } })
  await expect(page.locator('[data-annotation-id]')).toHaveCount(1)

  await page.getByRole('button', { name: 'Notes' }).click()
  const note = page.getByTestId('note')
  await expect(note).toHaveCount(1)
  await expect(note).toContainText('p. 1173')
  await expect(page.getByTestId('notes-paper')).toContainText('@')
  await page.getByPlaceholder('Filter quotes and comments').fill('nothing here')
  await expect(note).toHaveCount(0)
  await page.getByPlaceholder('Filter quotes and comments').fill('')

  // The save dialog is native; drive the export through the bridge with an explicit path, then check the file twice.
  const out = join(userData, 'notes.md')
  const ids = await page.evaluate(() => window.skim!.notes.list().then((n) => [n[0].paper_id, n[0].id]))
  await page.evaluate(([pid, id, path]) => window.skim!.notes.export({ paperId: pid, ids: [id], style: 'pandoc', path }), [ids[0], ids[1], out])
  const first = readFileSync(out, 'utf8')
  expect(first).toMatch(/\[@[a-z0-9]+, p\. 1173\]/)
  expect(first).toContain('skim://paper/')
  await page.evaluate(([pid, id, path]) => window.skim!.notes.export({ paperId: pid, ids: [id], style: 'pandoc', path }), [ids[0], ids[1], out])
  expect(readFileSync(out, 'utf8')).toBe(first)
  await app.close()
})
