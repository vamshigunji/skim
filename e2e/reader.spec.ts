import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const fixture = resolve('e2e/fixtures/sample.pdf')

const launch = (userData: string): Promise<ElectronApplication> =>
  electron.launch({ args: ['out/main/index.js', fixture], env: { ...process.env, SKIM_USER_DATA: userData } })

test('opens a PDF from the command line, navigates by label and outline, restores position on relaunch', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  let app = await launch(userData)
  let page = await app.firstWindow()

  const counter = page.getByTestId('page-counter')
  await expect(counter).toHaveText('P. i / 3')
  await expect(page.getByTestId('thumbnail')).toHaveCount(3)

  await page.getByRole('button', { name: 'OUTLINE' }).click()
  await page.getByRole('button', { name: 'Introduction' }).click()
  await expect(counter).toHaveText('P. 1174 / 3')

  const goto = page.getByPlaceholder('Go to page')
  await goto.fill('1173')
  await goto.press('Enter')
  await expect(counter).toHaveText('P. 1173 / 3')

  const before = (await page.locator('canvas').first().boundingBox())!.width
  await page.getByRole('button', { name: 'Zoom in' }).click()
  expect((await page.locator('canvas').first().boundingBox())!.width).toBeGreaterThan(before)

  await app.close()
  app = await launch(userData)
  page = await app.firstWindow()
  await expect(page.getByTestId('page-counter')).toHaveText('P. 1173 / 3')
  await app.close()
})
