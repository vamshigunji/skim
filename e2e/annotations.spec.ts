import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const fixture = resolve('e2e/fixtures/sample.pdf')

test('double-click highlights a word, it persists across relaunch, click-then-Delete removes it, Cmd+Z restores it', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const env = { ...process.env, SKIM_USER_DATA: userData }
  let app = await electron.launch({ args: ['out/main/index.js', fixture], env })
  let page = await app.firstWindow()
  await expect(page.getByTestId('page-counter')).toHaveText('P. i / 3')

  const word = page.locator('.textLayer span').filter({ hasText: 'attention' }).first()
  const box = (await word.boundingBox())!
  await word.dblclick({ position: { x: box.width - 6, y: box.height / 2 } })
  const marks = page.locator('[data-annotation-id]')
  await expect(marks).toHaveCount(1)
  await expect(page.getByTestId('annotations-panel')).toContainText('attention')
  await app.close()

  app = await electron.launch({ args: ['out/main/index.js', fixture], env })
  page = await app.firstWindow()
  await expect(page.locator('[data-annotation-id]')).toHaveCount(1)
  await page.locator('[data-annotation-id]').first().click()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-annotation-id]')).toHaveCount(0)
  await page.keyboard.press('Meta+z')
  await expect(page.locator('[data-annotation-id]')).toHaveCount(1)
  await app.close()
})
