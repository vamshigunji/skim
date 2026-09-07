import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const fixture = resolve('e2e/fixtures/cited.pdf')

test('hover a citation for a card, click through to the bibliography, Backspace returns; figure cards and the references tab', async () => {
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js', fixture], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  const counter = page.getByTestId('page-counter')
  await expect(counter).toHaveText('P. 1 / 2')

  await page.locator('mark[data-ref="1"]').first().hover()
  const card = page.getByTestId('hover-card')
  await expect(card).toContainText('Attention is all you need')
  await expect(card).toContainText('Not in library')
  await card.getByTestId('hover-card-body').click()
  await expect(counter).toHaveText('P. 2 / 2')
  await page.keyboard.press('Backspace')
  await expect(counter).toHaveText('P. 1 / 2')

  await page.locator('mark[data-region="figure:1"]').first().hover()
  await expect(card).toContainText('Figure 1: Attention weights across heads')
  await expect(card.locator('canvas')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(card).toHaveCount(0)

  await page.getByRole('button', { name: 'REFS' }).click()
  const refs = page.getByTestId('references')
  await expect(refs).toContainText('Attention is all you need')
  await expect(refs).toContainText('2 mentions')
  await app.close()
})
