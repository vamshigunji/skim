import { _electron as electron, expect, test } from '@playwright/test'

test('launches a 1280x860 window titled Skim', async () => {
  const app = await electron.launch({ args: ['out/main/index.js'] })
  const page = await app.firstWindow()
  await expect(page).toHaveTitle('Skim')
  await expect(page.getByText('SKIM')).toBeVisible()
  const size = await page.evaluate(() => [window.innerWidth, window.innerHeight])
  expect(size).toEqual([1280, 860])
  await app.close()
})
