import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { startFakeServer } from '../src/main/services/ai/fake-server'

const fixture = resolve('e2e/fixtures/sample.pdf')

test('skim overlays are off by default, appear on toggle with only verified sentences, and respond to label toggles', async () => {
  const fake = await startFakeServer()
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js', fixture], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')
  await expect(page.locator('[data-skim]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('openai base URL').fill(fake.url)
  await page.getByLabel('openai model').fill('skim-model')
  await page.getByLabel('openai API key').fill('sk-e2e')
  await page.getByRole('button', { name: 'Save openai key' }).click()
  await page.getByRole('button', { name: 'Make openai default' }).click()
  await page.getByRole('button', { name: 'Test openai' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByTestId('test-output')).toContainText('confidence')

  await page.getByRole('button', { name: 'Reading', exact: true }).click()
  const skim = page.getByRole('button', { name: 'SKIM', exact: true })
  await expect(skim).toHaveAttribute('aria-pressed', 'false')
  await skim.click()
  await expect(page.locator('[data-skim]')).toHaveCount(2)
  await expect(page.locator('[data-skim="method"]')).toHaveCount(1)
  await expect(page.getByTestId('skim-bar')).toContainText('2 / 2')
  await page.getByLabel('result', { exact: true }).uncheck()
  await expect(page.locator('[data-skim]')).toHaveCount(1)
  await page.getByLabel('Density').fill('5')
  await expect(page.getByTestId('skim-bar')).toContainText('1 / 2')
  await skim.click()
  await expect(page.locator('[data-skim]')).toHaveCount(0)
  await app.close()
  await fake.close()
})
