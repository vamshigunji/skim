import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const fixture = resolve('e2e/fixtures/sample.pdf')

test('finds in the open document with Cmd+F and across the library from the command bar', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js', fixture], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  const counter = page.getByTestId('page-counter')
  await expect(counter).toHaveText('P. i / 3')

  await page.keyboard.press('Meta+f')
  const find = page.getByPlaceholder('Find in document')
  await expect(find).toBeFocused()
  await find.fill('attention')
  await find.press('Enter')
  await expect(page.getByTestId('hit-count')).toHaveText('1 / 2')
  await expect(counter).toHaveText('P. 1173 / 3')
  await find.press('Enter')
  await expect(page.getByTestId('hit-count')).toHaveText('2 / 2')
  await expect(counter).toHaveText('P. 1174 / 3')

  await page.getByRole('button', { name: 'Library' }).click()
  const bar = page.getByPlaceholder('Search papers…')
  await bar.fill('Front matter')
  await bar.press('Enter')
  const results = page.getByTestId('search-results')
  await expect(results).toContainText('p. i')
  await results.getByRole('button', { name: /p\. i/ }).click()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')
  await app.close()
})
