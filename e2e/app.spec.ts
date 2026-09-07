import { _electron as electron, expect, test } from '@playwright/test'

test('launches the shell at 1280x860 with a 206px rail and a Cmd+K palette', async () => {
  const app = await electron.launch({ args: ['out/main/index.js'] })
  const page = await app.firstWindow()
  await expect(page).toHaveTitle('Skim')
  await expect(page.getByText('SKIM', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([1280, 860])
  expect((await page.locator('nav').boundingBox())?.width).toBe(206)
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('dialog')).toBeVisible()
  await app.close()
})
