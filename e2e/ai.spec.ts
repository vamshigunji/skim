import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startFakeServer } from '../src/main/services/ai/fake-server'

test('configure a hosted provider, confirm egress, stream a test reply with a meter, then switch AI off', async () => {
  const fake = await startFakeServer()
  const userData = mkdtempSync(join(tmpdir(), 'skim-e2e-'))
  const app = await electron.launch({ args: ['out/main/index.js'], env: { ...process.env, SKIM_USER_DATA: userData } })
  const page = await app.firstWindow()
  await expect(page.locator('header')).toContainText('OLLAMA')

  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByLabel('openai base URL').fill(fake.url)
  await page.getByLabel('openai model').fill('fake-model')
  await page.getByLabel('openai API key').fill('sk-e2e')
  await page.getByRole('button', { name: 'Save openai key' }).click()
  await page.getByRole('button', { name: 'Make openai default' }).click()
  await expect(page.locator('header')).toContainText('OPENAI · fake-model')

  await page.getByRole('button', { name: 'Test openai' }).click()
  await expect(page.getByRole('dialog')).toContainText('will be sent')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByTestId('test-output')).toContainText('Hello from fake')
  await expect(page.getByTestId('meter')).toContainText('in 5')
  expect(fake.calls.at(-1)?.auth).toBe('Bearer sk-e2e')

  await page.getByLabel('AI enabled').click()
  await expect(page.locator('header')).toContainText('AI OFF')
  await app.close()
  await fake.close()
})
