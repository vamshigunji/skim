import { _electron as electron, expect, test } from '@playwright/test'

test('launches the shell at 1280x860 with a 206px rail and a Cmd+K palette', async () => {
  const app = await electron.launch({ args: ['out/main/index.js'] })
  const page = await app.firstWindow()
  await expect(page).toHaveTitle('Skim')
  await expect(page.getByText('SKIM', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([1280, 860])
  expect((await page.locator('nav').boundingBox())?.width).toBe(206)
  // Electron hardening (design/08): sandboxed renderer, no window.open, no navigation, no Node in the page.
  expect(await app.evaluate(({ BrowserWindow }) => (BrowserWindow.getAllWindows()[0].webContents as unknown as { getLastWebPreferences: () => object }).getLastWebPreferences())).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false })
  expect(await page.evaluate(() => [window.open('https://example.com'), typeof (window as unknown as { require?: unknown }).require])).toEqual([null, 'undefined'])
  // A real navigation would leave Playwright waiting on the cancelled load, so ask the registered listener directly.
  expect(
    await app.evaluate(({ BrowserWindow }) => {
      let prevented = false
      BrowserWindow.getAllWindows()[0].webContents.emit('will-navigate', { preventDefault: () => (prevented = true) }, 'https://example.com')
      return prevented
    }),
  ).toBe(true)
  await page.keyboard.press('Meta+k')
  await expect(page.getByRole('dialog')).toBeVisible()
  await app.close()
})
