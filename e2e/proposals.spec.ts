import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { startFakeServer } from '../src/main/services/ai/fake-server'

const fixture = resolve('e2e/fixtures/sample.pdf')

test('AI suggestions arrive as a diff, nothing changes until approved, approval applies the checked items, and undo restores them', async () => {
  const fake = await startFakeServer()
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js', fixture], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('openai base URL').fill(fake.url)
  await page.getByLabel('openai model').fill('propose-model')
  await page.getByLabel('openai API key').fill('sk-e2e')
  await page.getByRole('button', { name: 'Save openai key' }).click()
  await page.getByRole('button', { name: 'Make openai default' }).click()
  await page.getByRole('button', { name: 'Test openai' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByTestId('test-output')).toContainText('set_field')

  await page.getByRole('button', { name: 'Library', exact: true }).click()
  const row = page.getByTestId('paper-row')
  const original = (await row.locator('span').first().textContent())!
  await page.getByRole('button', { name: /Suggest fixes/ }).click()
  const items = page.getByTestId('proposal-item')
  await expect(items).toHaveCount(2)
  await expect(items.first()).toContainText('→ Attention Is All You Need')
  await expect(items.first()).toContainText('Model judgement')
  await expect(row).toContainText(original) // nothing applied yet
  await page.getByLabel('Apply tag “transformers”').check()
  await page.getByRole('button', { name: /APPROVE 2 SELECTED/ }).click()
  await expect(row).toContainText('Attention Is All You Need')
  await expect(row).toContainText('transformers')
  await expect(page.getByTestId('applied-proposal')).toContainText('2 applied')

  await page.getByRole('button', { name: 'UNDO' }).click()
  await expect(row).toContainText(original)
  await expect(row).not.toContainText('transformers')
  await expect(page.getByTestId('applied-proposal')).toContainText('undone')
  await app.close()
  await fake.close()
})
