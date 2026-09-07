import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { startFakeServer } from '../src/main/services/ai/fake-server'

const fixture = resolve('e2e/fixtures/sample.pdf')

test('ask about the open paper, get a page-cited answer, click a chip to land on the highlighted passage', async () => {
  const fake = await startFakeServer()
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js', fixture], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('openai base URL').fill(fake.url)
  await page.getByLabel('openai model').fill('grounded-model')
  await page.getByLabel('openai API key').fill('sk-e2e')
  await page.getByRole('button', { name: 'Save openai key' }).click()
  await page.getByRole('button', { name: 'Make openai default' }).click()
  await page.getByRole('button', { name: 'Test openai' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByTestId('test-output')).toContainText('scaled dot products')

  await page.getByRole('button', { name: 'Reading', exact: true }).click()
  await page.getByRole('button', { name: 'ASK', exact: true }).click()
  const box = page.getByPlaceholder('Ask about this paper')
  await box.fill('How is attention computed?')
  await box.press('Enter')
  await expect(page.getByTestId('answer-state')).toHaveText('PARTIAL')
  await expect(page.getByTestId('answer-footer')).toContainText('1 of 2 claims verified')
  const chips = page.getByTestId('citation-chip')
  await expect(chips).toHaveCount(2)
  await expect(chips.first()).toContainText('p. 1173')
  await chips.first().click()
  await expect(page.getByTestId('page-counter')).toHaveText('P. 1173 / 3')
  await expect(page.locator('[data-flash]')).toHaveCount(1)
  await app.close()
  await fake.close()
})
