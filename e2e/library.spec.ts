import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const fixture = resolve('e2e/fixtures/sample.pdf')

test('imports on open, lists the paper with index status, persists across relaunch, reopens from the list', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const env = { ...process.env, SKIM_USER_DATA: userData }

  let app = await electron.launch({ args: ['out/main/index.js', fixture], env })
  let page = await app.firstWindow()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')
  await app.close()

  app = await electron.launch({ args: ['out/main/index.js'], env })
  page = await app.firstWindow()
  await expect(page.getByText('Front matter')).toBeVisible()
  await expect(page.getByTestId('index-status')).toContainText('Ready')
  await page.getByRole('button', { name: /Front matter/ }).click()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')
  await app.close()
})
