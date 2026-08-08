import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+3MxZ5wAAAABJRU5ErkJggg==', 'base64')

async function deterministicTiles(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng }))
}

async function expectNoSeriousViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page })
    .analyze()
  const violations = results.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
  expect(violations, `${context}: ${violations.map((item) => `${item.id} (${item.nodes.length})`).join(', ')}`).toEqual([])
}

test.beforeEach(async ({ page }) => deterministicTiles(page))

test('intro and map workspace have no serious automated accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expectNoSeriousViolations(page, 'intro')
  await page.getByRole('button', { name: '进入星图' }).click()
  await expect(page.locator('.map-person-marker').first()).toBeVisible({ timeout: 20_000 })
  await expectNoSeriousViolations(page, 'workspace')
})

test('directory modal exposes an accessible isolated dialog', async ({ page }) => {
  await page.goto('/?period=tang&person=li-bai')
  await page.getByRole('button', { name: /名录/ }).last().click()
  const dialog = page.getByRole('dialog', { name: '名人名录' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('searchbox', { name: '搜索人物' })).toBeFocused()
  await expectNoSeriousViolations(page, 'directory')
})
