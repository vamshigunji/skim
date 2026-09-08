import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { startFakeServer } from '../src/main/services/ai/fake-server'

const sample = resolve('e2e/fixtures/sample.pdf')
const cited = resolve('e2e/fixtures/cited.pdf')

test('ask across selected papers, see paper-named citations and a coverage footer, click a chip to open that paper at the page', async () => {
  const fake = await startFakeServer()
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js', sample], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')
  await page.evaluate((p) => window.skim!.library.import([p]), cited)

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('openai base URL').fill(fake.url)
  await page.getByLabel('openai model').fill('cross-model')
  await page.getByLabel('openai API key').fill('sk-e2e')
  await page.getByRole('button', { name: 'Save openai key' }).click()
  await page.getByRole('button', { name: 'Make openai default' }).click()
  await page.getByRole('button', { name: 'Test openai' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByTestId('test-output')).toContainText('scaled dot products')

  await page.getByRole('button', { name: 'Library', exact: true }).click()
  await expect(page.getByTestId('paper-row')).toHaveCount(2)
  for (const box of await page.getByRole('checkbox', { name: /^Select / }).all()) await box.check()
  await page.getByRole('button', { name: 'ASK 2 PAPERS' }).click()
  await expect(page.getByTestId('library-ask')).toContainText('SCOPE · 2 SELECTED PAPERS')
  const box = page.getByPlaceholder('Ask about this paper')
  await box.fill('scaled dot-product attention')
  await box.press('Enter')
  await expect(page.getByTestId('answer-state')).toHaveText('VERIFIED')
  const chip = page.getByTestId('citation-chip')
  await expect(chip).toHaveCount(1)
  await expect(chip).toHaveText(/^[a-z0-9]+, p\. 1173$/)
  await expect(page.getByTestId('coverage')).toHaveText('Searched 2 papers · 2 contributed passages · 0 skipped (not indexed) · semantic retrieval on')
  await chip.click()
  await expect(page.getByTestId('page-counter')).toHaveText('P. 1173 / 3')
  await app.close()
  await fake.close()
})
